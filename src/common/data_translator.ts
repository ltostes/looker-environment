import {
    VisQueryResponse
} from './types'
import { d3formatType } from './utils';
import * as d3 from 'd3';

// Types

interface Field {
    name: string;
    label_short: string;
    label: string;
    type: string;
    is_table_calculation?: boolean;
    value_format?: string;
  }
  
  interface Dimension {
    name: string;
    model: string | null;
    label: string;
    type: string;
    keys: string[];
    info: string;
  }
  
  interface Measure {
    name: string;
    looker_value_format: string;
    model: string | null;
    label: string;
    type: string;
    info: string;
    is_table_calculation?: boolean;
  }
  
  interface Pivot {
    name: string;
    model: string | null;
    label: string;
    type: string;
    keys: string[];
    info: string;
  }
  
  interface Row {
    [key: string]: any;
  }

// Function

export function lookerDataTranslator(
    query_response: VisQueryResponse, in_data: Row[]): 
    {
        data: Row[];
        dimensions: Dimension[];
        measures: Measure[];
        pivots: Pivot[];
        super_measures: Measure[];
        super_data: Row[];
    } {

    const data = in_data;

    const acessor_function = (d : Dimension | Pivot | Measure ) => d.model ? d.model + '.' + d.name : d.name ;
  
    const dimensions: Dimension[] = query_response.fields.dimensions.map((dim : Field) => ({
            name: dim.name.includes('.') ? dim.name.split('.')[1] : dim.name, 
            model: dim.name.includes('.') ? dim.name.split('.')[0] : null, 
            label: dim.label_short,
            type: dim.type,
            info: 'dimension',
            keys: [...new Set(in_data.map((d : Row) => ['date_month','date_quarter'].includes(dim.type) ? d[dim.name].value + "-01" : d[dim.name].value))],
            }));
    
    const pivots: Pivot[] = query_response.fields.pivots.map((piv: Field, i) => ({
            name: piv.name.includes('.') ? piv.name.split('.')[1] : piv.name,
            model: piv.name.includes('.') ? piv.name.split('.')[0] : null, 
            label: piv.label_short,
            type: piv.type,
            info: 'pivot',
            keys: []
          })).map((piv : Pivot, i) => ({
            ...piv,
            keys: [...new Set(query_response.pivots.map((d) => d.data[acessor_function(piv)]))]
          }))

    const measures: Measure[] = query_response.fields.measure_like?.map((mes: Field) => ({
      name: mes.name.includes('.') ? mes.name.split('.')[1] : mes.name, 
      model: mes.name.includes('.') ? mes.name.split('.')[0] : null, 
      label: mes.name.includes('.') ? mes.label_short : mes.label,
      type: mes.name.includes('.') ? mes.type : 'sum',
      info: 'measure',
      is_table_calculation: mes.is_table_calculation,
      looker_value_format: mes.value_format,
      d3_value_format: d3formatType(mes.value_format),
      }));

    const super_measures: Measure[] = query_response.fields.supermeasure_like?.map((mes: Field) => ({
      name: mes.name.includes('.') ? mes.name.split('.')[1] : mes.name, 
      model: mes.name.includes('.') ? mes.name.split('.')[0] : null, 
      label: mes.name.includes('.') ? mes.label_short : mes.label,
      type: mes.name.includes('.') ? mes.type : 'sum',
      info: 'supermeasure',
      is_table_calculation: mes.is_table_calculation,
      looker_value_format: mes.value_format,
      d3_value_format: d3formatType(mes.value_format),
      })) || [];
  
    const all_props = [...dimensions, ...pivots]
      
    let prepared_dataset = data; //[];

    if (pivots.length == 0) {
        const c_accessors : Array<Dimension | Measure>  = [...dimensions,...measures]
        prepared_dataset = data.map(row => (Object.assign({},...c_accessors.map((d: Dimension | Measure) => ({[d.name]: (row[acessor_function(d)]).value})))))
      
    } else {
        // Auxiliary functions
        const equals = (a, b) => JSON.stringify(a) === JSON.stringify(b);
        const cartesian = (...a) => a.reduce((a, b) => a.flatMap(d => b.map(e => [d, e].flat())));

        // Adjustments to Looker's weird inclusion of a last undetected value after the last '|FIELD\'
        const max_pivot_index = pivots.length;
        const fix_pivot_key = (pivot_key) => pivot_key.split('|FIELD|').slice(0, max_pivot_index).join('|FIELD|');
      
        // Function to get the data values of the built dim x pivots combination
        const value_acessor = function(mes,row){
          const filtered_obj_before_pivots = data.find(d_row => equals(
                                       dimensions.map(dim => d_row[acessor_function(dim)].value),
                                       dimensions.map(dim => row[dim.name])
                                                    )
                                    );
          if (typeof filtered_obj_before_pivots == 'undefined') {return null;}
          const filtered_before_pivots = filtered_obj_before_pivots[acessor_function(mes)];

          const adjusted_pivot_key = Object.keys(filtered_before_pivots).find(key => fix_pivot_key(key) == row.pivots_key)
          const filtered_data = filtered_before_pivots[adjusted_pivot_key];

          return filtered_data ? filtered_data.value : filtered_data;
        }
        
        // Making the cartesian product of all props and turning them into nice objects
        const rows_props =  cartesian(...all_props.map(prop => prop.keys)).map((row : Array<Array<string>>) => 
                     Object.assign(
                       {},...row.map( (prop,i) => ({[all_props[i].name] : prop})),
                  ));

        // Function to get the pivots keys based on a data row
        function get_pivots_key(row) {
          return pivots.map(pivot => row[pivot.name]).join('|FIELD|');
        }
        
        // Calculating the pivots_key to make it easier to access multi-pivots later
        const row_props_piv = rows_props.map(row => ({...row, pivots_key: get_pivots_key(row)}));

        // Finally populating with the actual measure values
        const row_values_raw = row_props_piv.map(row => 
                       ({...row, 
                         ...Object.assign({},...measures.map(mes => ({[mes.name] : value_acessor(mes,row)})))
                        })
                        );

        // Filtering all 'unassigned' from the cartesian product
        const row_values = row_values_raw; //.filter(d => d[measures[0].name]);
      
        prepared_dataset =  row_values;
    }

    // Supermeasures data
    let sm_prepared_dataset = [];
    if (super_measures) {
      const sm_accessors : Array<Dimension | Measure>  = [...dimensions,...super_measures]
      sm_prepared_dataset = data.map(row => (Object.assign({},...sm_accessors.map((d: Dimension | Measure) => ({[d.name]: (row[acessor_function(d)]).value})))))
    }

    // Fixing dates in month and quarter
    dimensions.filter(d => ['date_month','date_quarter'].includes(d.type)).forEach(function(dim) {
        prepared_dataset = prepared_dataset.map(d => ({...d, [dim.name]: d[dim.name] + '-01'}));
    })

    // Fixing pivots that are filtered
    const unc_count_data = prepared_dataset.map(d => ({...d, non_unc: d3.sum(measures.map(m => typeof d[m.name] == 'undefined' ? 0 : 1))}))
    const valid_pivot_keys = piv => d3.rollups(unc_count_data, v => d3.sum(v, d => d.non_unc), d => d[piv.name]).filter(f => f[1] > 0).map(d => d[0]);

    const fixed_pivots = pivots.map(p => ({...p, keys: valid_pivot_keys(p)}));

    const fixed_pivots_dataset = prepared_dataset.filter(f => fixed_pivots.map(p => p.keys.includes(f[p.name])).every(v => v === true))

    return {data: fixed_pivots_dataset, dimensions, measures, pivots: fixed_pivots, super_measures, super_data: sm_prepared_dataset};
};
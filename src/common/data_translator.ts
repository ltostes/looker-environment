import {
    VisQueryResponse
} from './types'

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
    } {

    const data = in_data;
  
    const dimensions: Dimension[] = query_response.fields.dimensions.map((dim : Field) => ({
            name: dim.name.includes('.') ? dim.name.split('.')[1] : dim.name, 
            model: dim.name.includes('.') ? dim.name.split('.')[0] : null, 
            label: dim.label_short,
            type: dim.type,
            keys: [...new Set(in_data.map((d : Row) => ['date_month','date_quarter'].includes(dim.type) ? d[dim.name].value + "-01" : d[dim.name].value))],
            info: 'dimension',
            }));

    const measures: Measure[] = query_response.fields.measure_like.map((mes: Field) => ({
            name: mes.name.includes('.') ? mes.name.split('.')[1] : mes.name, 
            model: mes.name.includes('.') ? mes.name.split('.')[0] : null, 
            label: mes.name.includes('.') ? mes.label_short : mes.label,
            type: mes.name.includes('.') ? mes.type : 'sum',
            info: 'measure',
            is_table_calculation: mes.is_table_calculation,
            looker_value_format: mes.value_format,
            }));
  
    const pivots: Pivot[] = query_response.fields.pivots.map((piv: Field, i) => ({
            name: piv.name.includes('.') ? piv.name.split('.')[1] : piv.name,
            model: piv.name.includes('.') ? piv.name.split('.')[0] : null, 
            label: piv.label_short,
            type: piv.type,
            keys: [...new Set(query_response.pivots.map((d: {key: string}) => d.key.split('|FIELD|')[i]))],
            info: 'pivot',
          }))

    const acessor_function = (d : Dimension | Pivot | Measure ) => d.model ? d.model + '.' + d.name : d.name ;
  
    const all_props = [...dimensions, ...pivots]
  
    const time_dim_acessor = acessor_function(dimensions[0])
    
    let prepared_dataset = data; //[];

    if (pivots.length == 0) {
        const c_accessors : Array<Dimension | Measure>  = [...dimensions,...measures]
        prepared_dataset = data.map(row => (Object.assign({},...c_accessors.map((d: Dimension | Measure) => ({[d.name]: (row[acessor_function(d)]).value})))))
      
    } else {
        // Auxiliary functions
        const equals = (a, b) => JSON.stringify(a) === JSON.stringify(b);
        const cartesian = (...a) => a.reduce((a, b) => a.flatMap(d => b.map(e => [d, e].flat())));
      
        const value_acessor = function(mes,row){
          const filtered_data = data.filter(d_row => equals(
                                       dimensions.map(dim => d_row[acessor_function(dim)].value),
                                       dimensions.map(dim => row[dim.name])
                                                    )
                                    )
                                   [0]
                                   [acessor_function(mes)]  
                                   [row.pivots_key];
          return filtered_data ? filtered_data.value : filtered_data;
        }
        
        // First making the cartesian product of all props and turning them into nice objects
        const rows_props =  cartesian(...all_props.map(prop => prop.keys)).map((row : Array<Array<string>>) => 
                     Object.assign(
                       {},...row.map( (prop,i) => ({[all_props[i].name] : prop})),
                  ));

        // Calculating the pivots_key to make it easier to access multi-pivots later
        const row_props_piv = rows_props.map(row => ({...row, pivots_key: [...pivots.map(p => row[p.name])].join('|FIELD|')}));

        // Finally populating with the actual measure values
        const row_values_raw = row_props_piv.map(row => 
                       ({...row, 
                         ...Object.assign({},...measures.map(mes => ({[mes.name] : value_acessor(mes,row)})))
                        })
                        );

        // Filtering all 'unassigned' from the cartesian product
        const row_values = row_values_raw.filter(d => d[measures[0].name]);
      
        prepared_dataset =  row_values;
    }

    // Fixing dates in month and quarter
    dimensions.filter(d => ['date_month','date_quarter'].includes(d.type)).forEach(function(dim) {
        prepared_dataset = prepared_dataset.map(d => ({...d, [dim.name]: d[dim.name] + '-01'}));
    })

    return {data: prepared_dataset, dimensions: dimensions, measures: measures, pivots: pivots};
};
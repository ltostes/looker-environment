import * as d3 from 'd3'

import {
    VisConfig,
    VisQueryResponse,
    VisualizationDefinition
} from './types'

export const d3formatType = (valueFormat: string) => {
    if (!valueFormat) return undefined
    let format = ''
    switch (valueFormat.charAt(0)) {
        case '$':
            format += '$'; break
        case '£':
            format += '£'; break
        case '€':
            format += '€'; break
    }
    if (valueFormat.indexOf(',') > -1) {
        format += ','
    }
    const splitValueFormat = valueFormat.split('.')
    format += '.'
    format += splitValueFormat.length > 1 ? splitValueFormat[1].length : 0

    switch (valueFormat.slice(-1)) {
        case '%':
            format = format.slice(0,-1) + `${Number(format.slice(-1)) - 1}%`; break
        case '0':
            format += 'f'; break
    }
    // console.log({valueFormat, format});
    return format
}

export const formatType = (valueFormat: string) => {
    return d3.format(d3formatType(valueFormat));
}

export const handleErrors = (vis: VisualizationDefinition, res: VisQueryResponse, options: VisConfig) => {

    const check = (group: string, noun: string, count: number, min: number, max: number): boolean => {
        if (!vis.addError || !vis.clearErrors) return false
        if (count < min) {
            vis.addError({
                title: `Not Enough ${noun}s`,
                message: `This visualization requires ${min === max ? 'exactly' : 'at least'} ${min} ${noun.toLowerCase()}${ min === 1 ? '' : 's' }.`,
                group
            })
            return false
        }
        if (count > max) {
            vis.addError({
                title: `Too Many ${noun}s`,
                message: `This visualization requires ${min === max ? 'exactly' : 'no more than'} ${max} ${noun.toLowerCase()}${ min === 1 ? '' : 's' }.`,
                group
            })
            return false
        }
        vis.clearErrors(group)
        return true
    }

    const { pivots, dimensions, measure_like: measures } = res.fields

    return (check('pivot-req', 'Pivot', pivots.length, options.min_pivots, options.max_pivots)
        && check('dim-req', 'Dimension', dimensions.length, options.min_dimensions, options.max_dimensions)
        && check('mes-req', 'Measure', measures.length, options.min_measures, options.max_measures))
}

export function looker_data_translator(query_response, in_data) {

    const data = in_data;
  
    const dimensions = query_response.fields.dimensions.map(dim => ({
            name: dim.name.includes('.') ? dim.name.split('.')[1] : dim.name, 
            model: dim.name.includes('.') ? dim.name.split('.')[0] : null, 
            label: dim.label_short,
            type: dim.type,
            keys: [...new Set(in_data.map(d => ['date_month','date_quarter'].includes(dim.type) ? d[dim.name].value + "-01" : d[dim.name].value))],
            info: 'dimension',
            }));

    const measures = query_response.fields.measure_like.map(mes => ({
            name: mes.name.includes('.') ? mes.name.split('.')[1] : mes.name, 
            model: mes.name.includes('.') ? mes.name.split('.')[0] : null, 
            label: mes.name.includes('.') ? mes.label_short : mes.label,
            type: mes.name.includes('.') ? mes.type : 'sum',
            info: 'measure',
            is_table_calculation: mes.is_table_calculation,
            }));
  
    const pivots = query_response.fields.pivots.map((piv, i) => ({
            name: piv.name.includes('.') ? piv.name.split('.')[1] : piv.name,
            model: piv.name.includes('.') ? piv.name.split('.')[0] : null, 
            label: piv.label_short,
            type: piv.type,
            keys: [...new Set(query_response.pivots.map(d => d.key.split('|FIELD|')[i]))],
            info: 'pivot',
          }))

    const acessor_function = d => d.model ? d.model + '.' + d.name : d.name ;
  
    const all_props = [...dimensions, ...pivots]
  
    const time_dim_acessor = acessor_function(dimensions[0])
    
    let prepared_dataset = data; //[];

    if (pivots.length == 0) {
        const c_accessors = [...dimensions,...measures]
        prepared_dataset = data.map(row => (Object.assign(...c_accessors.map(d => ({[d.name]: (row[acessor_function(d)]).value})))))
      
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
        const rows_props =  cartesian(...all_props.map(prop => prop.keys)).map(row => 
                     Object.assign(
                       ...row.map( (prop,i) => ({[all_props[i].name] : prop})),
                  ));

        // Calculating the pivots_key to make it easier to access multi-pivots later
        const row_props_piv = rows_props.map(row => ({...row, pivots_key: [...pivots.map(p => row[p.name])].join('|FIELD|')}));

        // Finally populating with the actual measure values
        const row_values_raw = row_props_piv.map(row => 
                       ({...row, 
                         ...Object.assign(...measures.map(mes => ({[mes.name] : value_acessor(mes,row)})))
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
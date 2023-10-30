import * as d3 from 'd3';
import * as Plot from "@observablehq/plot";

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
            format = format.slice(0,-1) + `${Math.max(0,Number(format.slice(-1)) - 1)}%`; break
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

export function autoMargin (
        data:any[], 
        accessor: (item: any) => string, 
        tickLabelPadding: number = 12, 
        fontSize:number = 10
    ) {
    // Adapted from https://observablehq.com/@tophtucker/autosize-margins-in-plot
    const avg_char_size = 0.53;

    // Text size estimator
    const measureText = (str, fontSize) => 
        d3.sum(str, (cur) => avg_char_size) * fontSize;

    // Getting largest label from data
    const largest_label = d3.max(Plot.valueof(data, accessor), (d) => measureText(d, fontSize));

    return largest_label + tickLabelPadding;
}
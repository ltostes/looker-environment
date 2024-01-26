import { Looker, VisualizationDefinition } from '../common/types';
import { handleErrors, d3formatType, autoMargin } from '../common/utils';
import { lookerDataTranslator } from '../common/data_translator';
// import './my-custom-viz.scss'

import { Radio, RadioGroup, FormControl, FormControlLabel, FormLabel, Container, Box, Grid, Typography, Checkbox, FormGroup } from '@mui/material';

import React from 'react'
import ReactDOM from 'react-dom'

import * as d3 from 'd3';
import * as Plot from "@observablehq/plot";

declare var looker: Looker;

interface MarkConfig {
    show: boolean
    type: string
    config: string
}

function RenderComponent({chartConfig}) {

  const headerRef = React.useRef<HTMLInputElement>();
  const gridRef = React.useRef<HTMLInputElement>();

  React.useEffect(() => {

    const gridHeight = gridRef.current ? gridRef.current.clientHeight : 0;
    const completedChartConfig = ({...chartConfig, extra: {...chartConfig.extra}, height: chartConfig.height - gridHeight});
    const chart = buildChart(completedChartConfig);

    headerRef.current.append(chart);

    return () => {
        chart.remove();
    }
  }, [chartConfig])

  return (
      <div>
        <header className="App-header" ref={headerRef} />
      </div>
  )
}

function buildChart({
        translated_data,
        params,
        extra,
        height,
        width
      }) {
                // Incrementing data
            const data_prefilter = translated_data.map((d,i) => ({
                ...d
            }))

            // Filtering data
            const data = data_prefilter.filter(d => !d.filter);

            // Possible measures
            const possible_measures = [...extra.measures, ...(extra.super_measures)]

            // Marks
            const mark1 = possible_measures.find(f => f.name == params['mark1']);
            const mark1_high = possible_measures.find(f => f.name == params['mark1_high']);
            const mark1_low = possible_measures.find(f => f.name == params['mark1_low']);

            const mark2 = possible_measures.find(f => f.name == params['mark2']);
            const mark2_type = params['mark2_type'];

            const mark3 = possible_measures.find(f => f.name == params['mark3']);
            const mark4 = possible_measures.find(f => f.name == params['mark4']);

            const main_mark = mark1 || mark2;

            // Options
            const charttype = params['charttype'];
            const x_axis = [...extra.dimensions, ...extra.pivots].find(f => f.name == params['x_axis']);
            const show_x_axis = params['show_x_axis'];
            const color = [...extra.dimensions, ...extra.pivots].find(f => f.name == params['color']);
            const show_color_legend = params['show_color_legend'];
            const fixed_color = d3['schemeTableau10'].find(f => f == params['color']);

            const facet_x = [...extra.dimensions, ...extra.pivots].find(f => f.name == params['facet_x']);
            const facet_y = [...extra.dimensions, ...extra.pivots].find(f => f.name == params['facet_y']);

            const mark_numformat = (params['mark_format'] == 'default' && (
                                                main_mark.d3_value_format
                                                || '.2f')
                                    )
                                    || params['mark_format'];
            const mark_numformatter = d3.format(mark_numformat);

            const fontSize = 12;

            // Labels
            function label_fun(mark_name, mark_obj) : string {
                return  ((params[mark_name + '_customlabel'] > '') && params[mark_name + '_customlabel'])
                        || (mark_obj && mark_obj.label.trim())
                        || ('None')
            }

            const mark1_label = label_fun('mark1',mark1);
            const mark1_low_label = label_fun('mark1_low',mark1_low);
            const mark1_high_label = label_fun('mark1_high',mark1_high);
            const mark2_label = label_fun('mark2',mark2);
            const mark3_label = label_fun('mark3',mark3);
            const mark4_label = label_fun('mark4',mark4);

            const x_axis_label = label_fun('x_axis',x_axis);
            const color_label = label_fun('color', color);
            const facet_x_label = label_fun('facet_x', facet_x);
            const facet_y_label = label_fun('facet_y', facet_y);

            // Type-specific config
            const show_highlow_labels = params['uncertainty_values'];

            const stack_2_3_4 = (charttype == 'stacked_area' && mark2_type == 'area' && mark3 && mark4); // Logic to calculate what type of stack it is
            const stack_2_3   = (charttype == 'stacked_area' && mark2_type == 'area' && mark3 && !stack_2_3_4);
            const stack_3_4   = (charttype == 'stacked_area' && mark2_type != 'area' && mark3 && mark4);
            const is_stack = stack_2_3_4 || stack_2_3 || stack_3_4;

            const stack_color_pallete = false
                            || (stack_2_3_4 && {domain: [mark2_label, mark3_label, mark4_label]})
                            || (stack_2_3   && {domain: [mark2_label, mark3_label]})
                            || (stack_3_4   && {domain: [mark3_label, mark4_label]})
                            || {};

            const threshold = !isNaN(params['threshold_number']) && (params['threshold_number'] > '') && Number(params['threshold_number']);
            const threshold_color = params['threshold_color'];

            // const remove_x_labels = !!(charttype == 'bar' && color); //-- Old automatic way to calculate
            
            // Version release dates (if present)
            const releasedates = possible_measures.find(f => f.name == 'release_version');

            // Common Marks
            const common_marks = [
                // Tip Mark
                Plot.tip(data, Plot.pointerX({
                    x: x_axis.name,
                    y: main_mark.name,
                    textOverflow: 'ellipsis-middle',
                    ...(color && {stroke: color.name}),
                    ...(fixed_color && {stroke: fixed_color}),
                    channels: 
                        {
    
                            ...(mark1 && {[mark1_label]: d => mark_numformatter(d[mark1.name])}),
                            ...(mark1_high && {[mark1_high_label]: d => mark_numformatter(d[mark1_high.name])}),
                            ...(mark1_low && {[mark1_low_label]: d => mark_numformatter(d[mark1_low.name])}),
                            ...(mark2 && {[mark2_label]: d => mark_numformatter(d[mark2.name])}),
                            ...(mark3 && {[mark3_label]: d => mark_numformatter(d[mark3.name])}),
                            ...(mark4 && {[mark4_label]: d => mark_numformatter(d[mark4.name])}),
                        },
                    // A stackY to when there's colored area in mark2
                    ...((color && mark2_type == 'area' && charttype == 'line') && Plot.stackY2({x: x_axis.name,y: main_mark.name,stroke: color.name}))
                }))
            ]

            // Marks for Line type
            const line_marks = [
                    ...(!mark1 ? [] : [
                        Plot.line(data,{
                            x: x_axis.name,
                            y: mark1.name,
                            ...(color && {stroke: color.name}),
                            ...(fixed_color && {stroke: fixed_color}),
                            ...(mark2 && {strokeWidth: 1}),
                        })
                    ]),
                    ...(!(mark1_high && mark1_low) ? [] : [
                        Plot.areaY(data,{
                            x: x_axis.name,
                            y1: mark1_high.name,
                            y2: mark1_low.name,
                            opacity: 0.3,
                            ...(color && {fill: color.name}),
                            ...(fixed_color && {fill: fixed_color}),
                        })
                    ]),
                    ...(!mark2 ? [] : [
                        ...(!(mark2_type == 'thick') ? [] : [
                                Plot.line(data,{
                                    x: x_axis.name,
                                    y: mark2.name,
                                    strokeWidth: 3,
                                    ...(color && {stroke: color.name}),
                                    ...(fixed_color && {stroke: fixed_color}),
                                })
                            ]),
                        ...(!(mark2_type == 'dot') ? [] : [
                                Plot.dot(data,{
                                    x: x_axis.name,
                                    y: mark2.name,
                                    ...(color && {fill: color.name}),
                                    ...(fixed_color && {fill: fixed_color}),
                                    r: 4, 
                                }),
                            ]), 
                        ...(!(mark2_type == 'area') ? [] : [
                                Plot.areaY(data,{
                                    x: x_axis.name,
                                    y: mark2.name,
                                    opacity: 0.3,
                                    ...(color && {fill: color.name}),
                                    ...(fixed_color && {fill: fixed_color}),
                                }),
                                Plot.line(data,{
                                    x: x_axis.name,
                                    y: mark2.name,
                                    strokeWidth: 2,
                                    ...(color && {...Plot.stackY2({y: mark2.name, x: x_axis.name, stroke: color.name})}),
                                    ...(fixed_color && {stroke: fixed_color}),
                                })
                            ]),
                    ]),
                    ...(!releasedates ? [] : [
                        Plot.ruleX(data, Plot.groupX({x:'first'},{
                            filter: f => f.release_version > '',
                            x: x_axis.name,
                            strokeOpacity: 0.3, 
                            strokeDasharray: '5,5'
                        })),
                        Plot.text(data, Plot.groupX({text:'first'},{
                            filter: f => f.release_version > '',
                            x: x_axis.name,
                            text: 'release_version',
                            frameAnchor: 'top',  
                            lineAnchor: 'bottom',
                            textAnchor: 'end', 
                            opacity: 0.3, 
                            rotate: -90, 
                            dx: -3
                        }))
                    ]),
                    // Tooltip marks
                    Plot.ruleX(data, Plot.pointerX({
                        x: x_axis.name,
                        strokeWidth: 0.5, 
                        strokeDasharray: '3,3'
                    })),
                    // Common marks (Tip)
                ]

            const bar_marks_params = {
                    // groups_domain: Array.from(d3.group(data, d => d.abgroup).keys())
                    backg_opacity: 0.3,
                    label_hor_offset: 2, 
                    label_ver_offset: 5, 
                    label_fontsize: 10,
                    bar_rx: 2,
                    borderWidth: 1,
                    ...(color && {unc_tick_color: color.name}),
                }
            
            const bar_marks = [
                ...(!mark1 ? [] : [
                    Plot.barY(data,{
                        x: x_axis.name,
                        y: mark1.name,
                        opacity: bar_marks_params.backg_opacity, 
                        rx: bar_marks_params.bar_rx,
                        ...(color && {fill: color.name}),
                        ...(fixed_color && {fill: fixed_color}),
                    }),
                    ...(color ? [
                        Plot.barY(data,{
                            x: x_axis.name,
                            y: mark1.name,
                            rx: bar_marks_params.bar_rx,
                            strokeWidth: bar_marks_params.borderWidth,
                            ...(color && {stroke: color.name}),
                            ...(fixed_color && {stroke: fixed_color}),
                        })
                        ] : []
                    ),
                    Plot.text(data,{ // Label when it's >= 0
                        filter: d => d[mark1.name] >= 0, 
                        x: x_axis.name,
                        y: mark1.name,
                        text: d => `${mark_numformatter(d[mark1.name])}`, 
                        lineAnchor: 'bottom', 
                        textAnchor: 'end', 
                        fontWeight: 'bold', 
                        fontSize: bar_marks_params.label_fontsize,
                        dx: - bar_marks_params.label_hor_offset, 
                        dy: - bar_marks_params.label_ver_offset, 
                        ...(color && {fill: color.name}),
                        ...(fixed_color && {fill: fixed_color}),
                    }),
                    Plot.text(data,{ // Label when it's < 0
                        filter: d => d[mark1.name] < 0, 
                        x: x_axis.name,
                        y: mark1.name,
                        text: d => `${mark_numformatter(d[mark1.name])}`, 
                        lineAnchor: 'top', 
                        textAnchor: 'end', 
                        fontWeight: 'bold', 
                        fontSize: bar_marks_params.label_fontsize,
                        dx: - bar_marks_params.label_hor_offset, 
                        dy: bar_marks_params.label_ver_offset, 
                        ...(color && {fill: color.name}),
                        ...(fixed_color && {fill: fixed_color}),
                    })
                ]),
                ...(!(mark1_high) ? [] : [
                    Plot.tickY(data,{
                        x: x_axis.name,
                        y: mark1_high.name,
                        ...(color && {stroke: bar_marks_params.unc_tick_color}),
                        ...(fixed_color && {stroke: fixed_color}),
                    }),
                    ...(show_highlow_labels ? [
                        Plot.text(data,{
                            x: x_axis.name,
                            y: mark1_high.name,
                            text: d => `${mark_numformatter(d[mark1_high.name])}`, 
                            lineAnchor: 'bottom', 
                            textAnchor: 'start', 
                            fontSize: bar_marks_params.label_fontsize,
                            dx: bar_marks_params.label_hor_offset, 
                            dy: - bar_marks_params.label_ver_offset, 
                            ...(color && {fill: bar_marks_params.unc_tick_color}),
                            ...(fixed_color && {fill: fixed_color}),
                        })] : []
                    )
                ]),
                ...(!(mark1_low) ? [] : [
                    Plot.tickY(data,{
                        x: x_axis.name,
                        y: mark1_low.name,
                        ...(color && {stroke: bar_marks_params.unc_tick_color}),
                        ...(fixed_color && {stroke: fixed_color}),
                    }),
                    ...(show_highlow_labels ? [
                        Plot.text(data,{
                            x: x_axis.name,
                            y: mark1_low.name,
                            text: d => `${mark_numformatter(d[mark1_low.name])}`, 
                            lineAnchor: 'top', 
                            textAnchor: 'start', 
                            fontSize: bar_marks_params.label_fontsize,
                            dx: bar_marks_params.label_hor_offset, 
                            dy: bar_marks_params.label_ver_offset, 
                            ...(color && {fill: bar_marks_params.unc_tick_color}),
                            ...(fixed_color && {fill: fixed_color}),
                        })
                    ] : [])
                ]),
                ...(!(mark1_high && mark1_low) ? [] : [
                    Plot.ruleX(data,{
                        x: x_axis.name,
                        y1: mark1_high.name,
                        y2: mark1_low.name,
                        ...(color && {stroke: bar_marks_params.unc_tick_color}),
                        ...(fixed_color && {stroke: fixed_color}),
                    })
                ]),
                ...(!mark2 ? [] : [
                    // Not used
                ]),
                // Complimentary marks (for visuals)
                Plot.ruleY([1],{
                    y: 0,
                    strokeWidth: 1,
                    strokeDasharray: '2,2'
                }),
                // Tooltip marks
            ]

            const stacked_area_marks = [
                    ...(!mark1 ? [] : [
                        Plot.line(data,{
                            x: x_axis.name,
                            y: mark1.name,
                            strokeWidth: 1,
                            ...(color && {stroke: color.name}),
                            ...(fixed_color && {stroke: fixed_color}),
                        })
                    ]),
                    ...(!(mark1_high && mark1_low) ? [] : [
                        Plot.areaY(data,{
                            x: x_axis.name,
                            y1: mark1_high.name,
                            y2: mark1_low.name,
                            opacity: 0.3,
                            ...(color && {fill: color.name}),
                            ...(fixed_color && {fill: fixed_color}),
                        })
                    ]),
                    ...(!mark2 ? [] : [
                        ...(!(mark2_type == 'thick') ? [] : [
                                Plot.line(data,{
                                    x: x_axis.name,
                                    y: mark2.name,
                                    strokeWidth: 3,
                                    ...(color && {stroke: color.name}),
                                    ...(fixed_color && {stroke: fixed_color}),
                                })
                            ]),
                        ...(!(mark2_type == 'dot') ? [] : [
                                Plot.dot(data,{
                                    x: x_axis.name,
                                    y: mark2.name,
                                    ...(color && {fill: color.name}),
                                    ...(fixed_color && {fill: fixed_color}),
                                    r: 4, 
                                }),
                            ])
                    ]),
                    // Stacks
                    ...(!stack_2_3 ? [] : [
                        // Area Mark 2
                        Plot.areaY(data,{
                            x: x_axis.name,
                            y1: d => (!(d[mark2.name] === undefined || d[mark2.name] === null)) ? 0 : null,
                            y2: d => (!(d[mark2.name] === undefined || d[mark2.name] === null)) ? d[mark2.name] : null,
                            opacity: 0.3,
                            fill: d => mark2_label
                        }),
                        Plot.line(data,{
                            x: x_axis.name,
                            y: mark2.name,
                            strokeWidth: 2,
                            stroke: d => mark2_label
                        }),
                        // Area Mark 3
                        Plot.areaY(data,{
                            x: x_axis.name,
                            y1: d => (!(d[mark2.name] === undefined || d[mark2.name] === null)) ? d[mark2.name] : null,
                            y2: d => (!(d[mark2.name] === undefined || d[mark2.name] === null)) ? d[mark2.name] + d[mark3.name] : null,
                            opacity: 0.3,
                            fill: d => mark3_label
                        }),
                        Plot.line(data,{
                            x: x_axis.name,
                            y: d => (!(d[mark2.name] === undefined || d[mark2.name] === null)) ? d[mark2.name] + d[mark3.name] : null,
                            strokeWidth: 2,
                            stroke: d => mark3_label
                        }),
                    ]),
                    ...(!stack_2_3_4 ? [] : [
                        // Area Mark 2
                        Plot.areaY(data,{
                            x: x_axis.name,
                            y1: d => (!(d[mark2.name] === undefined || d[mark2.name] === null)) ? 0 : null,
                            y2: d => (!(d[mark2.name] === undefined || d[mark2.name] === null)) ? d[mark2.name] : null,
                            opacity: 0.3,
                            fill: d => mark2_label
                        }),
                        Plot.line(data,{
                            x: x_axis.name,
                            y: mark2.name,
                            strokeWidth: 2,
                            stroke: d => mark2_label
                        }),
                        // Area Mark 3
                        Plot.areaY(data,{
                            x: x_axis.name,
                            y1: d => (!(d[mark2.name] === undefined || d[mark2.name] === null)) ? d[mark2.name] : null,
                            y2: d => (!(d[mark2.name] === undefined || d[mark2.name] === null)) ? d[mark2.name] + d[mark3.name] : null,
                            opacity: 0.3,
                            fill: d => mark3_label
                        }),
                        Plot.line(data,{
                            x: x_axis.name,
                            y: d => d[mark2.name] + d[mark3.name] > 0 ? d[mark2.name] + d[mark3.name] : null,
                            strokeWidth: 2,
                            stroke: d => mark3_label
                        }),
                        // Area Mark 4
                        Plot.areaY(data,{
                            x: x_axis.name,
                            y1: d => (!(d[mark2.name] === undefined || d[mark2.name] === null)) ? d[mark2.name] + d[mark3.name] : null,
                            y2: d => (!(d[mark2.name] === undefined || d[mark2.name] === null)) ? d[mark2.name] + d[mark3.name] + d[mark4.name] : null,
                            opacity: 0.3,
                            fill: d => mark4_label
                        }),
                        Plot.line(data,{
                            x: x_axis.name,
                            y: d => d[mark2.name] + d[mark3.name] + d[mark4.name] > 0 ? d[mark2.name] + d[mark3.name] + d[mark4.name] : null,
                            strokeWidth: 2,
                            stroke: d => mark4_label
                        }),
                    ]),
                    ...(!stack_3_4 ? [] : [
                        // Area Mark 3
                        Plot.areaY(data,{
                            x: x_axis.name,
                            y1: d => (!(d[mark3.name] === undefined || d[mark3.name] === null)) ? 0 : null,
                            y2: d => (!(d[mark3.name] === undefined || d[mark3.name] === null)) ? d[mark3.name] : null,
                            opacity: 0.3,
                            fill: d => mark3_label
                        }),
                        Plot.line(data,{
                            x: x_axis.name,
                            y: d => (!(d[mark3.name] === undefined || d[mark3.name] === null)) ? d[mark3.name] : null,
                            strokeWidth: 2,
                            stroke: d => mark3_label
                        }),
                        // Area Mark 4
                        Plot.areaY(data,{
                            x: x_axis.name,
                            y1: d => (!(d[mark3.name] === undefined || d[mark3.name] === null)) ? d[mark3.name] : null,
                            y2: d => (!(d[mark3.name] === undefined || d[mark3.name] === null)) ? d[mark3.name] + d[mark4.name] : null,
                            opacity: 0.3,
                            fill: d => mark4_label
                        }),
                        Plot.line(data,{
                            x: x_axis.name,
                            y: d => (!(d[mark3.name] === undefined || d[mark3.name] === null)) ? d[mark3.name] + d[mark4.name] : null,
                            strokeWidth: 2,
                            stroke: d => mark4_label
                        }),
                    ]),
                    // Release dates
                    ...(!releasedates ? [] : [
                        Plot.ruleX(data, Plot.groupX({x:'first'},{
                            filter: f => f.release_version > '',
                            x: x_axis.name,
                            strokeOpacity: 0.3, 
                            strokeDasharray: '5,5'
                        })),
                        Plot.text(data, Plot.groupX({text:'first'},{
                            filter: f => f.release_version > '',
                            x: x_axis.name,
                            text: 'release_version',
                            frameAnchor: 'top',  
                            lineAnchor: 'bottom',
                            textAnchor: 'end', 
                            opacity: 0.3, 
                            rotate: -90, 
                            dx: -3
                        }))
                    ]),
                    // Tooltip marks
                    Plot.ruleX(data, Plot.pointerX({
                        x: x_axis.name,
                        strokeWidth: 0.5, 
                        strokeDasharray: '3,3'
                    })),
                ]

            const line_threshold_marks = [
                ...(!mark1 ? [] : [
                    Plot.line(data,{
                        x: x_axis.name,
                        y: mark1.name,
                        ...(color && {stroke: color.name}),
                        ...(fixed_color && {stroke: fixed_color}),
                        ...(mark2 && {strokeWidth: 1}),
                    })
                ]),
                ...(!(mark1_high && mark1_low) ? [] : [
                    Plot.areaY(data,{
                        x: x_axis.name,
                        y1: mark1_high.name,
                        y2: mark1_low.name,
                        opacity: 0.3,
                        ...(color && {fill: color.name}),
                        ...(fixed_color && {fill: fixed_color}),
                    })
                ]),
                ...(!mark2 ? [] : [
                    ...(!(mark2_type == 'thick') ? [] : [
                            Plot.line(data,{
                                x: x_axis.name,
                                y: mark2.name,
                                strokeWidth: 3,
                                ...(color && {stroke: color.name}),
                                ...(fixed_color && {stroke: fixed_color}),
                            })
                        ]),
                    ...(!(mark2_type == 'dot') ? [] : [
                            Plot.dot(data,{
                                x: x_axis.name,
                                y: mark2.name,
                                fill: d => d[mark2.name] > threshold ? '#D32D41' : '#6AB187',
                                r: 3, 
                            }),
                        ]), 
                    ...(!(mark2_type == 'area') ? [] : [
                            Plot.areaY(data,{
                                x: x_axis.name,
                                y: mark2.name,
                                opacity: 0.3,
                                ...(color && {fill: color.name}),
                                ...(fixed_color && {fill: fixed_color}),
                            }),
                            Plot.line(data,{
                                x: x_axis.name,
                                y: mark2.name,
                                strokeWidth: 2,
                                ...(color && {...Plot.stackY2({y: mark2.name, x: x_axis.name, stroke: color.name})}),
                                ...(fixed_color && {stroke: fixed_color}),
                            })
                        ]),
                ]),
                // Threshold
                ...(!threshold ? [] : [
                    Plot.ruleY([threshold],{
                        strokeDasharray: '2,2',
                        stroke: threshold_color,
                    }),
                    Plot.text([{threshold}],{
                        y: 'threshold', 
                        fill: threshold_color, 
                        frameAnchor: 'right', 
                        text: d => `${d3.format(mark_numformat)(threshold)}\nThreshold`, 
                        lineAnchor: 'middle', 
                        dy: 5, 
                        textAnchor: 'start'
                    })
                ]),
                ...(!releasedates ? [] : [
                    Plot.ruleX(data, Plot.groupX({x:'first'},{
                        filter: f => f.release_version > '',
                        x: x_axis.name,
                        strokeOpacity: 0.3, 
                        strokeDasharray: '5,5'
                    })),
                    Plot.text(data, Plot.groupX({text:'first'},{
                        filter: f => f.release_version > '',
                        x: x_axis.name,
                        text: 'release_version',
                        frameAnchor: 'top',  
                        lineAnchor: 'bottom',
                        textAnchor: 'end', 
                        opacity: 0.3, 
                        rotate: -90, 
                        dx: -3
                    }))
                ]),
                // Tooltip marks
                Plot.ruleX(data, Plot.pointerX({
                    x: x_axis.name,
                    strokeWidth: 0.5, 
                    strokeDasharray: '3,3'
                })),
                // Common marks (Tip)
            ]

            // Plot object
            const plot_arguments = ({
                // Layout
                height: height,
                width: width,
                inset:10, 
                marginLeft: autoMargin(data, d => mark_numformatter(d[main_mark.name]),15,fontSize),
                marginRight: (
                              (facet_y && ['line','bar','line_threshold','stacked_area'].includes(charttype)) && (autoMargin(data, d => `${d[facet_y.name]}`,15,fontSize) + 15))
                              || (charttype == 'line_threshold' && 60)
                              || 15,
                marginBottom: (facet_x && charttype == 'bar') ? 50 : 50,
                marginTop: ((
                            (facet_x && charttype == 'line')
                            ||
                            (facet_x && charttype == 'bar' && x_axis && !color)
                            ) && 50)
                            || ((
                              facet_x && show_x_axis
                            ) && 50)
                            || 30,
                style: {
                    fontSize: fontSize + 'px' 
                },
                // Axes
                x: {
                    label: x_axis_label,
                    labelOffset: 40,
                    ...(['line','stacked_area','line_threshold'].includes(charttype) && {
                            ...(x_axis.type.includes('_date') && {type: 'utc' as Plot.ScaleType, ticks: 'week'}),
                            grid: true,
                        }),
                    // ...(remove_x_labels && {
                    ...(!show_x_axis && {  
                            axis: null,
                        }),
                },
                y: {
                    tickFormat: mark_numformat,
                    label: mark1_label == 'None' ? mark2_label : mark1_label,
                    grid: true,
                    nice: true,
                    zero: true
                },
                ...((color || is_stack) && {
                    color: {
                        ...(show_color_legend && {  
                            legend: true,
                        }),
                        type: 'categorical' as Plot.ScaleType,
                        label: color_label,
                        className: 'plotColorLegend',
                        ...stack_color_pallete
                    },
                }),
                facet: {
                    data,
                    ...(facet_x && {x: facet_x.name}),
                    ...(facet_y && {y: facet_y.name}),
                },
                ...(facet_x && {
                    fx: {
                        label: facet_x_label,
                        labelOffset: 35
                    }
                }),
                ...(facet_y && {
                    fy: {
                        label: facet_y_label,
                        labelOffset: autoMargin(data, d => `${d[facet_y.name]}`,15,fontSize) + 10 //35
                    }
                }),
                // Marks
                marks:
                [
                    ...(charttype == 'line' ? line_marks : [] ),
                    ...(charttype == 'bar' ? bar_marks : [] ),
                    ...(charttype == 'stacked_area' ? stacked_area_marks : [] ),
                    ...(charttype == 'line_threshold' ? line_threshold_marks : [] ),
                    ...common_marks
                ]
            })

            const pre_chart = Plot.plot(plot_arguments);

            // Calculating the need to rotate X axis
            const x_scale = pre_chart.scale('x');

            const max_length = autoMargin(data, d => `${d[x_axis.name]}`,0,fontSize);
            const sizetest = max_length > (x_scale.step + 10); // 10 is arbitrary here

            if (sizetest && show_x_axis) {
                const angle = 45;
                const angle_radians = angle * Math.PI / 180;
                const max_label_dist = (autoMargin(data, d => `${d[x_axis.name]}`,15,fontSize) * Math.sin(angle_radians));

                plot_arguments.x['tickRotate'] = angle;
                plot_arguments.x['labelOffset'] = max_label_dist + 5;
                plot_arguments['marginBottom'] = max_label_dist + 10;
            }

            const chart = Plot.plot(plot_arguments);

            // Adding the legend label
            const legendLabel = ((color || is_stack) && 
                                    d3.select(chart)
                                    .select('.plotColorLegend-swatches')
                                    .insert('span',":first-child").classed('plotColorLegend-swatch',true)
                                    .text(color_label)
                                    .style("font-size",`${fontSize}px`)
                                );


            return chart;
}

const get_options = function () {
    let vizOptions = {};

    let n_config = 4;

    // Main configs
    n_config++;

    vizOptions['charttype'] = {
        type: "string",
        section: "1. Main",
        label: "Type",
        display: "select",
        values: [
            {'Line': 'line'},
            {'Bar':'bar'},
            {'Stacked Area':'stacked_area'},
            {'Line with Threshold':'line_threshold'}
        ],
        display_size: 'normal',
        default: 'line',
        hidden: false,
        order: n_config
    }

    n_config++;

    vizOptions['breakdowns_label'] = {
        type: "string",
        section: "1. Main",
        label: "-- Breakdowns --",
        display: "divider", // This string is arbitrary it's just choosing an option that doesn't exist
        display_size: 'normal',
        hidden: false,
        order: n_config
    }

    n_config++;

    vizOptions['x_axis'] = {
        type: "string",
        section: "1. Main",
        label: "X Axis",
        display: "select",
        values: [],
        display_size: 'half',
        default: 'abs',
        hidden: false,
        order: n_config
    }

    n_config++;

    vizOptions['color'] = {
        type: "string",
        section: "1. Main",
        label: "Color",
        display: "select",
        values: [],
        display_size: 'half',
        default: 'abs',
        hidden: false,
        order: n_config
    }

    n_config++;

    vizOptions['show_x_axis'] = {
        type: "boolean",
        section: "1. Main",
        label: "Show X axis?",
        display: "select",
        display_size: 'half',
        default: true,
        hidden: false,
        order: n_config
    }
    
    n_config++;

    vizOptions['show_color_legend'] = {
        type: "boolean",
        section: "1. Main",
        label: "Show Color Legend?",
        display: "select",
        display_size: 'half',
        default: true,
        hidden: false,
        order: n_config
    }
    
    n_config++;

    vizOptions['marks_label'] = {
        type: "string",
        section: "1. Main",
        label: "-- Marks --",
        display: "divider", // This string is arbitrary it's just choosing an option that doesn't exist
        display_size: 'normal',
        hidden: false,
        order: n_config
    }

    n_config++;

    vizOptions['mark1'] = {
        type: "string",
        section: "1. Main",
        label: "Mark #1",
        display: "select",
        values: [],
        display_size: 'half',
        default: 'abs',
        hidden: false,
        order: n_config
    }

    n_config++;

    vizOptions['mark_format'] = {
        type: "string",
        section: "1. Main",
        label: "Number Format",
        display: "select",
        values: [
            {'Default':'default'},
            {'$0.':'$,.0f'},
            {'$0.0':'$,.1f'},
            {'$0.00':'$,.2f'},
            {'$0.000':'$,.3f'},
            {'%0.':'.0%'},
            {'%0.0':'.1%'},
            {'%0.00':'.2%'},
            {'%0.000':'.3%'},
            {'0.':',.0f'},
            {'0.0':',.1f'},
            {'0.00':',.2f'},
            {'0.000':',.3f'},
            {'1 sig. digits':'.1s'},
            {'2 sig. digits':'.2s'},
            {'3 sig. digits':'.3s'},
            {'$ 1 sig.':'$.1s'},
            {'$ 2 sig.':'$.2s'},
            {'$ 3 sig.':'$.3s'},
        ],
        display_size: 'half',
        default: 'default',
        hidden: false,
        order: n_config
    }

    n_config++;

    vizOptions['mark1_low'] = {
        type: "string",
        section: "1. Main",
        label: "Mark #1 - Low",
        display: "select",
        values: [],
        display_size: 'half',
        default: 'abs',
        hidden: false,
        order: n_config
    }

    n_config++;

    vizOptions['mark1_high'] = {
        type: "string",
        section: "1. Main",
        label: "Mark #1 - High",
        display: "select",
        values: [],
        display_size: 'half',
        default: 'abs',
        hidden: false,
        order: n_config
    }

    n_config++;

    vizOptions['uncertainty_values'] = {
        type: "boolean",
        section: "1. Main",
        label: "Show High/Low Values?",
        display: "select",
        display_size: 'normal',
        default: true,
        hidden: false,
        order: n_config
    }

    n_config++;

    vizOptions['threshold_number'] = {
        type: "string",
        section:"1. Main",
        label: "Threshold",
        display: "text",
        default: "",
        display_size: 'half',
        hidden: false,
        order: n_config
    }

    n_config++;

    vizOptions['threshold_color'] = {
        type: "string",
        section:"1. Main",
        label: "Threshold Color",
        display: "select",
        default: d3['schemeTableau10'][1],
        values: [
            {'Black':'black'},
            {'Blue': d3['schemeTableau10'][0]},
            {'Orange': d3['schemeTableau10'][1]},
            {'Red': d3['schemeTableau10'][2]},
            {'Teal (default)': d3['schemeTableau10'][3]},
            {'Green': d3['schemeTableau10'][4]},
            {'Yellow': d3['schemeTableau10'][5]},
            {'Purple': d3['schemeTableau10'][6]},
            {'Pink': d3['schemeTableau10'][7]},
            {'Brown': d3['schemeTableau10'][8]},
            {'Grey': d3['schemeTableau10'][9]},
        ],
        display_size: 'half',
        hidden: false,
        order: n_config
    }

    n_config++;

    vizOptions['mark2'] = {
        type: "string",
        section: "1. Main",
        label: "Mark #2",
        display: "select",
        values: [],
        display_size: 'half',
        default: '',
        hidden: false,
        order: n_config
    }

    n_config++;

    vizOptions['mark2_type'] = {
        type: "string",
        section: "1. Main",
        label: "Type (Mark #2)",
        display: "select",
        values: [
            {'Thick Line':'thick'},
            {'Dots':'dot'},
            {'Area':'area'},
        ],
        display_size: 'half',
        default: 'thick',
        hidden: false,
        order: n_config
    }

    n_config++;

    vizOptions['mark3'] = {
        type: "string",
        section: "1. Main",
        label: "Mark #3 (AreaStack)",
        display: "select",
        values: [],
        display_size: 'half',
        default: '',
        hidden: false,
        order: n_config
    }

    n_config++;

    vizOptions['mark4'] = {
        type: "string",
        section: "1. Main",
        label: "Mark #4 (AreaStack)",
        display: "select",
        values: [],
        display_size: 'half',
        default: '',
        hidden: false,
        order: n_config
    }

    n_config++;

    vizOptions['facets_label'] = {
        type: "string",
        section: "1. Main",
        label: "-- Facets --",
        display: "divider", // This string is arbitrary it's just choosing an option that doesn't exist
        display_size: 'normal',
        hidden: false,
        order: n_config
    }

    n_config++;

    vizOptions['facet_x'] = {
        type: "string",
        section: "1. Main",
        label: "Horizontal",
        display: "select",
        values: [],
        display_size: 'half',
        default: '',
        hidden: false,
        order: n_config
    }

    n_config++;

    vizOptions['facet_y'] = {
        type: "string",
        section: "1. Main",
        label: "Vertical",
        display: "select",
        values: [],
        display_size: 'half',
        default: '',
        hidden: false,
        order: n_config
    }

    n_config++;

    // Extra Options

    vizOptions['customlabels_label'] = {
        type: "string",
        section:"2. Extra",
        label: "-- Custom Labels --",
        display: "divider", // This string is arbitrary it's just choosing an option that doesn't exist
        display_size: 'normal',
        hidden: false,
        order: n_config
    }

    n_config++;

    vizOptions['x_axis_customlabel'] = {
        type: "string",
        section:"2. Extra",
        label: "X",
        display: "text",
        default: "",
        display_size: 'normal',
        hidden: false,
        order: n_config
    }

    n_config++;

    vizOptions['color_customlabel'] = {
        type: "string",
        section:"2. Extra",
        label: "Color",
        display: "text",
        default: "",
        display_size: 'normal',
        hidden: false,
        order: n_config
    }

    n_config++;

    vizOptions['mark1_customlabel'] = {
        type: "string",
        section:"2. Extra",
        label: "Mark 1",
        display: "text",
        default: "",
        display_size: 'normal',
        hidden: false,
        order: n_config
    }

    n_config++;

    vizOptions['mark1_low_customlabel'] = {
        type: "string",
        section:"2. Extra",
        label: "Mark 1 - Low",
        display: "text",
        default: "",
        display_size: 'normal',
        hidden: false,
        order: n_config
    }

    n_config++;

    vizOptions['mark1_high_customlabel'] = {
        type: "string",
        section:"2. Extra",
        label: "Mark 1 - High",
        display: "text",
        default: "",
        display_size: 'normal',
        hidden: false,
        order: n_config
    }

    n_config++;

    vizOptions['mark2_customlabel'] = {
        type: "string",
        section:"2. Extra",
        label: "Mark 2",
        display: "text",
        default: "",
        display_size: 'normal',
        hidden: false,
        order: n_config
    }

    n_config++;

    vizOptions['mark3_customlabel'] = {
        type: "string",
        section:"2. Extra",
        label: "Mark 3",
        display: "text",
        default: "",
        display_size: 'normal',
        hidden: false,
        order: n_config
    }

    n_config++;

    vizOptions['mark4_customlabel'] = {
        type: "string",
        section:"2. Extra",
        label: "Mark 4",
        display: "text",
        default: "",
        display_size: 'normal',
        hidden: false,
        order: n_config
    }

    n_config++;

    vizOptions['facet_x_customlabel'] = {
        type: "string",
        section:"2. Extra",
        label: "Facet X",
        display: "text",
        default: "",
        display_size: 'normal',
        hidden: false,
        order: n_config
    }

    n_config++;

    vizOptions['facet_y_customlabel'] = {
        type: "string",
        section: "2. Extra",
        label: "Facet Y",
        display: "text",
        default: "",
        display_size: 'normal',
        hidden: false,
        order: n_config
    }

    n_config++;

    return vizOptions;

}

const vis : VisualizationDefinition = {
    options: get_options(),
    // Set up the initial state of the visualization
    create(element, config) {
        // let root = element.appendChild(document.createElement("div"));
        // root.setAttribute("id", "root");

      // Create a container element to let us center the text.
      let container = element.appendChild(document.createElement("div"));
      // container.className = "hello-world-vis";

      // Create an element to contain the text.
      this._textElement = container.appendChild(document.createElement("div"));
    },
    // Render in response to the data or settings changing
    updateAsync(in_data, element, config, queryResponse, details, doneRendering) {
        // console.log( 'data', data );
        // console.log( 'element', element );
        // console.log( 'config', config );
        // console.log( 'queryResponse', queryResponse );

        const errors = handleErrors(this, queryResponse, {
            // min_pivots: 0,
            // max_pivots: 0,
            // min_dimensions: 1,
            // max_dimensions: 1,
            // min_measures: 1,
            // max_measures: 1
        });
        if (errors) { // errors === true means no errors
            
            // debugger;
            const raw_data = lookerDataTranslator(queryResponse, in_data);

            const measures = raw_data.measures;
            const dimensions = raw_data.dimensions;
            const pivots = raw_data.pivots;

            const super_measures = raw_data.super_measures;
            const super_data = raw_data.super_data;

            const translated_data = raw_data.data;

            // Now updating the options based on data available
            options_update(config, this, raw_data);

            // Collecting all parameters configured to complement measures and pivot
            const params : any = config; //config_to_parameters(config);

            // Building the visuals
            const width = element.getBoundingClientRect().width;
            const height = element.getBoundingClientRect().height;

            // Additional parameters
            // This iteration is to allow variables to be reused in definitions
            let extra = {measures, dimensions, pivots, width, height, super_measures};

            // SENDING TO CHART CONFIG
            const chart_config = {
              translated_data,
              params,
              extra,
              width,
              height
            }

            // Updating to super data if configured
            if (
                false
                || super_measures.map(d => d.name).includes(params.mark1)
                || super_measures.map(d => d.name).includes(params.mark2)
                || super_measures.map(d => d.name).includes(params.mark1_low)
                || super_measures.map(d => d.name).includes(params.mark1_high)
                ) {
                chart_config['translated_data'] = super_data;
            }

            // graph_node.node().append(addTooltips(Plot.plot(plot_arguments),tooltip_options));// Finally update the state with our new data
            this.chart = ReactDOM.render(
              <RenderComponent 
                  chartConfig={chart_config}
              />,
              this._textElement
            );

            doneRendering();

        }
    }
};


const options_update = function(config, vizObject,raw_data) {

    let myOptions = vizObject.options;

    // How the options will be added

    const list_as_option = d => ({[d.label] : d.name});
    const list_super_as_option = d => ({[`${d.label} *`] : d.name});

    const possible_dimensions = [
        ...((raw_data.dimensions.length == 0) ? [] : raw_data.dimensions.map(list_as_option)),
        ...((raw_data.pivots.length == 0) ? [] : raw_data.pivots.map(list_as_option)),
    ]

    const possible_measures = [
        {'None':''},
        ...((raw_data.measures.length == 0) ? [] : raw_data.measures.map(list_as_option)),
        ...((raw_data.super_measures.length == 0) ? [] : raw_data.super_measures.map(list_super_as_option)),
    ].filter(f => !(f['Released Versions']));

    const dim_options = ['x_axis', 'facet_x','facet_y'];

    dim_options.forEach(option => {
        myOptions[option] = {
            ...vizObject.options[option],
            values: [
                        ...(option == 'x_axis' ? [] : [{'None':''}]),
                        ...possible_dimensions
                    ]
        }
    })

    // Special case for colors: fixed color options
    const fixed_color_options = [
        {'-- Fixed color options below --':'fixed'},
        {'Blue': d3['schemeTableau10'][0]},
        {'Orange': d3['schemeTableau10'][1]},
        {'Red': d3['schemeTableau10'][2]},
        {'Teal (default)': d3['schemeTableau10'][3]},
        {'Green': d3['schemeTableau10'][4]},
        {'Yellow': d3['schemeTableau10'][5]},
        {'Purple': d3['schemeTableau10'][6]},
        {'Pink': d3['schemeTableau10'][7]},
        {'Brown': d3['schemeTableau10'][8]},
        {'Grey': d3['schemeTableau10'][9]},
    ]

    myOptions['color'] = {
        ...vizObject.options['color'],
        values: [
                    ...[{'None':d3['schemeTableau10'][3]}], // Default as teal
                    ...possible_dimensions,
                    ...fixed_color_options
                ]
    }

    const measure_options = ['mark1', 'mark1_high', 'mark1_low', 'mark2','mark3','mark4']


    measure_options.forEach(option => {
        myOptions[option] = {
            ...vizObject.options[option],
            values: possible_measures,
        }
    })

    // Deactivating unused options depending on type
    Object.keys(vizObject.options).forEach(k => {
        myOptions[k]['hidden'] = false;
    })

    const charttype = config['charttype'];

    if (['bar'].includes(charttype)) {
        myOptions['mark2']['hidden'] = true;
        myOptions['mark2_type']['hidden'] = true;
        myOptions['mark2_customlabel']['hidden'] = true;
        myOptions['mark3']['hidden'] = true;
        myOptions['mark3_customlabel']['hidden'] = true;
        myOptions['mark4']['hidden'] = true;
        myOptions['mark4_customlabel']['hidden'] = true;
        myOptions['threshold_number']['hidden'] = true;
    }
    if (['line'].includes(charttype)) {
        myOptions['uncertainty_values']['hidden'] = true;
        myOptions['mark3']['hidden'] = true;
        myOptions['mark3_customlabel']['hidden'] = true;
        myOptions['mark4']['hidden'] = true;
        myOptions['mark4_customlabel']['hidden'] = true;
        myOptions['threshold_number']['hidden'] = true;
    }
    if (['stacked_area'].includes(charttype)) {
        myOptions['uncertainty_values']['hidden'] = true;
        myOptions['threshold_number']['hidden'] = true;
    }
    if (['line_threshold'].includes(charttype)) {
        myOptions['uncertainty_values']['hidden'] = true;
        myOptions['mark3']['hidden'] = true;
        myOptions['mark3_customlabel']['hidden'] = true;
        myOptions['mark4']['hidden'] = true;
        myOptions['mark4_customlabel']['hidden'] = true;
    }

    vizObject.trigger('registerOptions', myOptions);

    return myOptions;
};

looker.plugins.visualizations.add(vis);

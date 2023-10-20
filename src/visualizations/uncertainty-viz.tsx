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

          // Options
          const charttype = params['charttype'];
          const x_axis = [...extra.dimensions, ...extra.pivots].find(f => f.name == params['x_axis']);
          const color = [...extra.dimensions, ...extra.pivots].find(f => f.name == params['color']);
          const facet_x = [...extra.dimensions, ...extra.pivots].find(f => f.name == params['facet_x']);
          const facet_y = [...extra.dimensions, ...extra.pivots].find(f => f.name == params['facet_y']);

          const mark1 = extra.measures.find(f => f.name == params['mark1']);
          const mark1_high = extra.measures.find(f => f.name == params['mark1_high']);
          const mark1_low = extra.measures.find(f => f.name == params['mark1_low']);
          const mark2 = extra.measures.find(f => f.name == params['mark2']);
          const mark2_type = params['mark2_type'];

          const main_mark = mark1 || mark2;

          const fontSize = 12;

          // Version release dates (if present)
          const releasedates = extra.measures.find(f => f.name == 'release_version');

          // Marks for Line type
          const line_marks = [
                ...(!mark1 ? [] : [
                    Plot.line(data,{
                        x: x_axis.name,
                        y: mark1.name,
                        ...(color && {stroke: color.name}),
                        ...(mark2 && {strokeWidht: 1}),
                    })
                ]),
                ...(!(mark1_high && mark1_low) ? [] : [
                    Plot.areaY(data,{
                        x: x_axis.name,
                        y1: mark1_high.name,
                        y2: mark1_low.name,
                        opacity: 0.3,
                        ...(color && {fill: color.name}),
                    })
                ]),
                ...(!mark2 ? [] : [
                    ...(!(mark2_type == 'thick') ? [] : [
                            Plot.line(data,{
                                x: x_axis.name,
                                y: mark2.name,
                                strokeWidth: 3,
                                ...(color && {stroke: color.name}),
                            })
                        ]),
                    ...(!(mark2_type == 'dot') ? [] : [
                        Plot.dot(data,{
                            x: x_axis.name,
                            y: mark2.name,
                            ...(color && {fill: color.name}),
                            r: 4, 
                        }),
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
                Plot.tip(data, Plot.pointerX({
                    x: x_axis.name,
                    y: main_mark.name,
                    ...(color && {stroke: color.name}),
                    channels: 
                        {

                            ...(mark1 && {[mark1.label]: d => d3.format(main_mark.d3_value_format)(d[mark1.name])}),
                            ...(mark2 && {[mark2.label]: d => d3.format(main_mark.d3_value_format)(d[mark2.name])}),
                            ...(mark1_high && {[mark1_high.label]: d => d3.format(main_mark.d3_value_format)(d[mark1_high.name])}),
                            ...(mark1_low && {[mark1_low.label]: d => d3.format(main_mark.d3_value_format)(d[mark1_low.name])}),
                        }
                }))
            ]

            const bar_marks_params = {
                // groups_domain: Array.from(d3.group(data, d => d.abgroup).keys())
                backg_opacity: 0.3,
                num_format: main_mark.d3_value_format, 
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
                }),
                Plot.barY(data,{
                    filter: f => color,
                    x: x_axis.name,
                    y: mark1.name,
                    rx: bar_marks_params.bar_rx,
                    strokeWidth: bar_marks_params.borderWidth,
                    ...(color && {stroke: color.name}),
                }),
                Plot.text(data,{ // Label when it's >= 0
                    filter: d => d[mark1.name] >= 0, 
                    x: x_axis.name,
                    y: mark1.name,
                    text: d => `${d3.format(bar_marks_params.num_format)(d[mark1.name])}`, 
                    lineAnchor: 'bottom', 
                    textAnchor: 'end', 
                    fontWeight: 'bold', 
                    fontSize: bar_marks_params.label_fontsize,
                    dx: - bar_marks_params.label_hor_offset, 
                    dy: - bar_marks_params.label_ver_offset, 
                    ...(color && {fill: color.name}),
                }),
                Plot.text(data,{ // Label when it's < 0
                    filter: d => d[mark1.name] < 0, 
                    x: x_axis.name,
                    y: mark1.name,
                    text: d => `${d3.format(bar_marks_params.num_format)(d[mark1.name])}`, 
                    lineAnchor: 'bottom', 
                    textAnchor: 'end', 
                    fontWeight: 'bold', 
                    fontSize: bar_marks_params.label_fontsize,
                    dx: - bar_marks_params.label_hor_offset, 
                    dy: bar_marks_params.label_ver_offset, 
                    ...(color && {fill: color.name}),
                })
            ]),
            ...(!(mark1_high) ? [] : [
                Plot.tickY(data,{
                    x: x_axis.name,
                    y: mark1_high.name,
                    ...(color && {stroke: bar_marks_params.unc_tick_color}),
                }),
                Plot.text(data,{
                    x: x_axis.name,
                    y: mark1_high.name,
                    text: d => `${d3.format(bar_marks_params.num_format)(d[mark1_high.name])}`, 
                    lineAnchor: 'bottom', 
                    textAnchor: 'start', 
                    fontSize: bar_marks_params.label_fontsize,
                    dx: bar_marks_params.label_hor_offset, 
                    dy: - bar_marks_params.label_ver_offset, 
                    ...(color && {fill: bar_marks_params.unc_tick_color}),
                })
            ]),
            ...(!(mark1_low) ? [] : [
                Plot.tickY(data,{
                    x: x_axis.name,
                    y: mark1_low.name,
                    ...(color && {stroke: bar_marks_params.unc_tick_color}),
                }),
                Plot.text(data,{
                    x: x_axis.name,
                    y: mark1_low.name,
                    text: d => `${d3.format(bar_marks_params.num_format)(d[mark1_low.name])}`, 
                    lineAnchor: 'top', 
                    textAnchor: 'start', 
                    fontSize: bar_marks_params.label_fontsize,
                    dx: bar_marks_params.label_hor_offset, 
                    dy: bar_marks_params.label_ver_offset, 
                    ...(color && {fill: bar_marks_params.unc_tick_color}),
                })
            ]),
            ...(!(mark1_high && mark1_low) ? [] : [
                Plot.ruleX(data,{
                    x: x_axis.name,
                    y1: mark1_high.name,
                    y2: mark1_low.name,
                    opacity: 0.3,
                    ...(color && {stroke: bar_marks_params.unc_tick_color}),
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
            Plot.tip(data, Plot.pointerX({
                x: x_axis.name,
                y: main_mark.name,
                ...(color && {stroke: color.name}),
                channels: 
                    {

                        ...(mark1 && {[mark1.label]: d => d3.format(main_mark.d3_value_format)(d[mark1.name])}),
                        ...(mark2 && {[mark2.label]: d => d3.format(main_mark.d3_value_format)(d[mark2.name])}),
                        ...(mark1_high && {[mark1_high.label]: d => d3.format(main_mark.d3_value_format)(d[mark1_high.name])}),
                        ...(mark1_low && {[mark1_low.label]: d => d3.format(main_mark.d3_value_format)(d[mark1_low.name])}),
                    }
            }))
          ]

          // Plot object
          const plot_arguments = ({
            // Layout
            height: height,
            width: width,
            inset:10, 
            marginLeft: autoMargin(data, d => d3.format(main_mark.d3_value_format)(d[main_mark.name]),15,fontSize),
            marginRight: (facet_y && charttype == 'line') ? autoMargin(data, d => d[facet_y.name],10,fontSize) : 15,
            marginBottom:(facet_x && charttype == 'bar') ? 50 : 30,
            marginTop: (
                        (facet_x && charttype == 'line')
                        ||
                        (facet_x && charttype == 'bar' && x_axis && !color)
                       ) ? 50 : 30,
            style: {
                fontSize: fontSize + 'px' 
            },
            // Axes
            x: {
                label: x_axis.label,
                labelOffset: 40,
                ...(charttype == 'line' && {
                        ...(x_axis.type.includes('_date') && {type: 'utc' as Plot.ScaleType, ticks: 'week'}),
                        grid: true,
                    }),
                ...(charttype == 'bar' && {
                        ...(color && {axis: null}),
                    })
            },
            y: {
                tickFormat: main_mark.d3_value_format,
                label: main_mark.label,
                grid: true,
                nice: true,
                zero: true
            },
            ...(color && {
                color: {
                    legend: true,
                    type: 'categorical' as Plot.ScaleType,
                    label: color.label,
                    className: 'plotColorLegend'
                },
            }),
            facet: {
                data,
                ...(facet_x && {x: facet_x.name}),
                ...(facet_y && {y: facet_y.name}),
            },
            ...(facet_x && {
                fx: {
                    label: facet_x.label,
                    labelOffset: 35
                }
            }),
            ...(facet_y && {
                fy: {
                    label: facet_y.label,
                    labelOffset: 35
                }
            }),
            // Marks
            marks:
            [
                ...(charttype == 'line' ? line_marks : [] ),
                ...(charttype == 'bar' ? bar_marks : [] ),
            ]
          })

          const chart = Plot.plot(plot_arguments);

          // Adding the legend label
          const legendLabel = (color && 
                                d3.select(chart)
                                .select('.plotColorLegend-swatches')
                                .insert('span',":first-child").classed('plotColorLegend-swatch',true)
                                .text(color.label)
                                .style("font-size",`${fontSize}px`)
                               );
          
          // Attaching the visuals
          return chart;
}

const get_options = function () {
    let vizOptions = {};

    let n_config = 4;

    // Main configs
    n_config++;

    vizOptions['charttype'] = {
        type: "string",
        section:"Main",
        label: "Type",
        display: "select",
        values: [
            {'Line': 'line'},
            {'Bar':'bar'},
            // {'Area':'area'},
        ],
        display_size: 'normal',
        default: 'line',
        hidden: false,
        order: n_config
    }

    n_config++;

    vizOptions['breakdowns_label'] = {
        type: "string",
        section:"Main",
        label: "-- Breakdowns --",
        display: "divider", // This string is arbitrary it's just choosing an option that doesn't exist
        display_size: 'normal',
        hidden: false,
        order: n_config
    }

    n_config++;

    vizOptions['x_axis'] = {
        type: "string",
        section:"Main",
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
        section:"Main",
        label: "Color",
        display: "select",
        values: [],
        display_size: 'half',
        default: 'abs',
        hidden: false,
        order: n_config
    }

    n_config++;

    vizOptions['marks_label'] = {
        type: "string",
        section:"Main",
        label: "-- Marks --",
        display: "divider", // This string is arbitrary it's just choosing an option that doesn't exist
        display_size: 'normal',
        hidden: false,
        order: n_config
    }

    n_config++;

    vizOptions['mark1'] = {
        type: "string",
        section:"Main",
        label: "Mark #1",
        display: "select",
        values: [],
        display_size: 'normal',
        default: 'abs',
        hidden: false,
        order: n_config
    }

    n_config++;

    vizOptions['mark1_high'] = {
        type: "string",
        section:"Main",
        label: "Mark #1 - High",
        display: "select",
        values: [],
        display_size: 'half',
        default: 'abs',
        hidden: false,
        order: n_config
    }

    n_config++;

    vizOptions['mark1_low'] = {
        type: "string",
        section:"Main",
        label: "Mark #1 - Low",
        display: "select",
        values: [],
        display_size: 'half',
        default: 'abs',
        hidden: false,
        order: n_config
    }

    n_config++;

    vizOptions['mark2'] = {
        type: "string",
        section:"Main",
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
        section:"Main",
        label: "Type (Mark #2)",
        display: "select",
        values: [
            {'Thick Line':'thick'},
            {'Dots':'dot'},
        ],
        display_size: 'half',
        default: 'thick',
        hidden: false,
        order: n_config
    }

    n_config++;

    vizOptions['facets_label'] = {
        type: "string",
        section:"Main",
        label: "-- Facets --",
        display: "divider", // This string is arbitrary it's just choosing an option that doesn't exist
        display_size: 'normal',
        hidden: false,
        order: n_config
    }

    n_config++;

    vizOptions['facet_x'] = {
        type: "string",
        section:"Main",
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
        section:"Main",
        label: "Vertical",
        display: "select",
        values: [],
        display_size: 'half',
        default: '',
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

            const translated_data = raw_data.data //dataFulfiller(raw_data);

            // Now updating the options based on data available
            options_update(config, this, raw_data);

            // Collecting all parameters configured to complement measures and pivot
            const params : any = config; //config_to_parameters(config);

            // Building the visuals
            const width = element.getBoundingClientRect().width;
            const height = element.getBoundingClientRect().height;

            // Additional parameters
            // This iteration is to allow variables to be reused in definitions
            let extra = {measures, dimensions, pivots, width, height};

            // SENDING TO CHART CONFIG
            const chart_config = {
              translated_data,
              params,
              extra,
              width,
              height
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

    const possible_dimensions = [
        ...((raw_data.dimensions.length == 0) ? [] : raw_data.dimensions.map(list_as_option)),
        ...((raw_data.pivots.length == 0) ? [] : raw_data.pivots.map(list_as_option)),
    ]

    const possible_measures = [
        {'None':''},
        ...((raw_data.measures.length == 0) ? [] : raw_data.measures.map(list_as_option)),
    ].filter(f => !(f['Released Versions']));

    const dim_options = ['x_axis', 'color','facet_x','facet_y'];

    dim_options.forEach(option => {
        myOptions[option] = {
            ...vizObject.options[option],
            values: [
                        ...(option == 'x_axis' ? [] : [{'None':''}]),
                        ...possible_dimensions
                    ]
        }
    })
    const measure_options = ['mark1', 'mark1_high', 'mark1_low', 'mark2']


    measure_options.forEach(option => {
        myOptions[option] = {
            ...vizObject.options[option],
            values: possible_measures,
        }
    })

    // Deactivating unused options depending on type
    const charttype = config['charttype'];

    if (charttype == 'bar') {
        myOptions['mark2']['hidden'] = true;
        myOptions['mark2_type']['hidden'] = true;

    } else {
        myOptions['mark2']['hidden'] = false;
        myOptions['mark2_type']['hidden'] = false;
    }

    vizObject.trigger('registerOptions', myOptions);

    return myOptions;
};

looker.plugins.visualizations.add(vis);

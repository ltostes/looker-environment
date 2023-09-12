import { Looker, VisualizationDefinition } from '../common/types';
import { handleErrors, d3formatType } from '../common/utils';
import { lookerDataTranslator } from '../common/data_translator';
// import './my-custom-viz.scss'

import { Radio, RadioGroup, FormControl, FormControlLabel, FormLabel, Container, Box, Grid, Typography } from '@mui/material';

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

function TestComponent({chartConfig, params}) {

  const initialParameters = Object.assign({},...params.map(p => ({[p.varname]:p.config_obj.default})));

  const [liveParameters, setLiveParameters] = React.useState(initialParameters);

  function handleParamUpdate(event, varname) {
    const updatedLiveParameters = ({...liveParameters, [varname]: event.target.value});
    setLiveParameters(updatedLiveParameters);
  }

  const headerRef = React.useRef<HTMLInputElement>();
  const gridRef = React.useRef<HTMLInputElement>();

  React.useEffect(() => {

    const gridHeight = gridRef.current.clientHeight;
    const completedChartConfig = ({...chartConfig, extra: {...chartConfig.extra, ...liveParameters}, height: chartConfig.height - gridHeight});
    const chart = buildChart(completedChartConfig);
    // const chart = buildMixAdjustChart(completedChartConfig);
    headerRef.current.append(chart);

    return () => chart.remove();
  }, chartConfig.params.liveupdate ? [chartConfig, liveParameters] : [liveParameters])

  return (
      <div>
        <Grid container spacing={1} ref={gridRef}>
          {
            params.map(p => 
                p.show && <Grid item xs>
                      <FormControl>
                        <FormLabel>{p.viewlabel}</FormLabel>
                        <RadioGroup
                          row
                          value={liveParameters[p.varname]}
                          onChange={(event) => handleParamUpdate(event,p.varname)}
                        >
                          {
                            p.config_obj.list.map(k => <FormControlLabel value={k} control={<Radio />} label={k} componentsProps={{typography: <Typography variant="body2"/>}} />)
                          }
                        </RadioGroup>
                      </FormControl>
                    </Grid>
              )
          }
        
        </Grid>
        <header className="App-header" ref={headerRef} />
      </div>
  )
}

function buildChart({
        translated_data,
        interpret_fun,
        params,
        extra,
        height,
        width
      }) {
            // Incrementing data
          const data_prefilter = translated_data.map((d,i) => ({
              ...d,
              ...interpret_fun(params['data'], translated_data,extra, d, i),
          }))

          // Filtering data
          const data = data_prefilter.filter(d => !d.filter);

          // Config parameters
          const x_config = interpret_fun(params['x'],data,extra);
          const y_config = interpret_fun(params['y'],data,extra);
          const facet_config = interpret_fun(params['facet'],data,extra);
          const layout_config = interpret_fun(params['layout'],data,extra);
          const style_config = interpret_fun(params['style'],data,extra);
          const color_config = interpret_fun(params['color'],data,extra);
          const tooltip_options = interpret_fun(params['tooltip_options'],data,extra);
          const others_config = interpret_fun(params['others'],data,extra);

          const mark_configs = params.mark_config;

          // Plot object
          const plot_arguments = ({
              height: height,
              width: width,
              ...((params['layout'] != '') && layout_config),
              ...((params['x'] != '') && ({x: x_config})),
              ...((params['y'] != '') && ({y: y_config})),
              ...((params['facet'] != '') && ({facet: {data: data, ...facet_config}})),
              ...((params['style'] != '') && ({style: style_config})),
              ...((params['color'] != '') && ({color: color_config})),

              marks:
                  mark_configs
                      .filter( d => ['dot','line','areaY','areaX','barY','barX','text','tickY','tickX','link','ruleY','ruleX','cell','arrow','vector','image','frame', 'rect', 'rectX', 'rectY','tip','tree','raster','gridX','gridY','auto','crosshair'].includes(d.type) && (d.show))
                      .map(function(d) {

                          const mark_config = interpret_fun(d.config,data,extra);
                          
                          const plot_params = {
                              ...mark_config
                          };

                          if (plot_params.hide) {return;}

                          switch(d.type) {

                              case 'dot': return Plot.dot(data, plot_params);
                              case 'line': return Plot.line(data, plot_params);
                              case 'areaY': return Plot.areaY(data, plot_params);
                              case 'areaX': return Plot.areaX(data, plot_params);
                              case 'barY': return Plot.barY(data, plot_params);
                              case 'barX': return Plot.barX(data, plot_params);
                              case 'text': return Plot.text(data, plot_params);
                              case 'tickY': return Plot.tickY(data, plot_params);
                              case 'tickX': return Plot.tickX(data, plot_params);
                              case 'link': return Plot.link(data, plot_params);
                              case 'ruleY': return Plot.ruleY(data, plot_params);
                              case 'ruleX': return Plot.ruleX(data, plot_params);
                              case 'cell': return Plot.ruleX(data, plot_params);
                              case 'arrow': return Plot.arrow(data, plot_params);
                              case 'vector': return Plot.vector(data, plot_params);
                              case 'image': return Plot.image(data, plot_params);
                              case 'frame': return Plot.frame();
                              case 'rect': return Plot.rect(data, plot_params);
                              case 'rectX': return Plot.rectX(data, plot_params);
                              case 'rectY': return Plot.rectY(data, plot_params);
                              case 'tip': return Plot.tip(data, plot_params);
                              case 'tree': return Plot.tree(data, plot_params);
                              case 'raster': return Plot.raster(data, plot_params);
                              case 'gridX': return Plot.gridX(data, plot_params);
                              case 'gridY': return Plot.gridY(data, plot_params);
                              case 'auto': return Plot.auto(data, plot_params);
                              case 'crosshair': return Plot.crosshair(data, plot_params);

                          }
                  }),
              ...((params['others'] != '') && others_config),
          })
          
          // Attaching the visuals
          return addTooltips(Plot.plot(plot_arguments),tooltip_options);
}

function buildMixAdjustChart({
  translated_data,
  interpret_fun,
  params,
  extra,
  height,
  width
}) {
  // Data calculations
  const [g_segment_data, mix_adjusted_whole] = calculateMixAdjustData(
    translated_data,
    extra
  );

  // Graph params
  const segment_domain = extra.dimensions[2].keys;
  const segment_label_function_1 = (d) => `\n${d}\n\n (Mix effect)`;
  const segment_label_function_2 = (d) => `\n${d}\n\n (Perf)`;

  const whole_bar_x_labels = ["RR (ref)", "RR (ref)\n Mix Adjusted", "RR main"];
  const x_domain = [
    whole_bar_x_labels[0],
    ...segment_domain.map(segment_label_function_1),
    whole_bar_x_labels[1],
    ...segment_domain.map(segment_label_function_2),
    whole_bar_x_labels[2]
  ];
  const solid_bars_values = [
    mix_adjusted_whole.n_ref / mix_adjusted_whole.d_ref,
    mix_adjusted_whole.rr_mixadjusted_compounded,
    mix_adjusted_whole.n_main / mix_adjusted_whole.d_main
  ];
  const perc_margin = 0.01;
  const y_domain = [
    d3.min(solid_bars_values) - perc_margin,
    d3.max(solid_bars_values) + perc_margin
  ];
  const opacity_solid_bars = 0.6;

  const label_params = {};

  // Finally plotting
  return Plot.plot({
    marginLeft: 50,
    width: width,
    height: height,
    insetTop: 10,
    insetBottom: 10,
    marginBottom: 45,
    style: { fontSize: "12px" },
    x: {
      domain: x_domain,
      label: null
    },
    y: {
      tickFormat: ".1%",
      nice: true,
      label: "RR 1",
      grid: true,
      zero: false,
      domain: y_domain
    },
    color: {
      range: ["red", "green"]
    },
    marks: [
      // Whole bars
      Plot.barY([mix_adjusted_whole], {
        x: [whole_bar_x_labels[0]],
        y: (d) => d.n_ref / d.d_ref,
        clip: true,
        opacity: opacity_solid_bars
      }),
      Plot.barY([mix_adjusted_whole], {
        x: [whole_bar_x_labels[1]],
        y: (d) => d.rr_mixadjusted_compounded,
        clip: true,
        opacity: opacity_solid_bars
      }),
      Plot.barY([mix_adjusted_whole], {
        x: [whole_bar_x_labels[2]],
        y: (d) => d.n_main / d.d_main,
        clip: true,
        opacity: opacity_solid_bars
      }),
      // Whole bars labels
      Plot.text([mix_adjusted_whole], {
        x: [whole_bar_x_labels[0]],
        y: (d) => d.n_ref / d.d_ref,
        text: (d) => `${d3.format(".1%")(d.n_ref / d.d_ref)}`,
        dy: -10,
        lineAnchor: "bottom",
        fontWeight: "bold"
      }),
      Plot.text([mix_adjusted_whole], {
        x: [whole_bar_x_labels[1]],
        y: (d) => d.rr_mixadjusted_compounded,
        text: (d) => `${d3.format(".1%")(d.rr_mixadjusted_compounded)}`,
        dy: -10,
        lineAnchor: "bottom",
        fontWeight: "bold"
      }),
      Plot.text([mix_adjusted_whole], {
        x: [whole_bar_x_labels[2]],
        y: (d) => d.n_main / d.d_main,
        text: (d) => `${d3.format(".1%")(d.n_main / d.d_main)}`,
        dy: -10,
        lineAnchor: "bottom",
        fontWeight: "bold"
      }),
      // Volume effect bars
      Plot.barY(g_segment_data, {
        x: (d) => segment_label_function_1(d.segment),
        // y: "volume_effect",
        y1: "volume_compound_pre",
        y2: "volume_compound_post",
        fill: (d) => d.volume_effect > 0,
        opacity: 0.6
      }),
      // Volume effect labels
      Plot.text(g_segment_data, {
        filter: (d) => d.volume_effect < 0,
        x: (d) => segment_label_function_1(d.segment),
        y: (d) => d.volume_compound_post,
        fill: (d) => d.volume_effect > 0,
        text: (d) => `${d3.format("+.1%")(d.volume_effect)}`,
        lineAnchor: "top",
        fontWeight: "bold",
        dy: 5
      }),
      Plot.text(g_segment_data, {
        filter: (d) => d.volume_effect > 0,
        x: (d) => segment_label_function_1(d.segment),
        y: (d) =>
          d.volume_effect > 0 ? d.volume_compound_post : d.volume_compound_pre,
        fill: (d) => d.volume_effect > 0,
        text: (d) => `${d3.format("+.1%")(d.volume_effect)}`,
        lineAnchor: "bottom",
        fontWeight: "bold",
        dy: -5
      }),
      // Segment effect bars
      Plot.barY(g_segment_data, {
        x: (d) => segment_label_function_2(d.segment),
        // y: "volume_effect",
        y1: "segment_compound_pre",
        y2: "segment_compound_post",
        fill: (d) => d.segment_effect > 0,
        opacity: 0.6
      }),
      // Segment effect labels
      Plot.text(g_segment_data, {
        filter: (d) => d.segment_effect < 0,
        x: (d) => segment_label_function_2(d.segment),
        y: (d) => d.segment_compound_post,
        fill: (d) => d.segment_effect > 0,
        text: (d) => `${d3.format("+.1%")(d.segment_effect)}`,
        lineAnchor: "top",
        fontWeight: "bold",
        dy: 5
      }),
      Plot.text(g_segment_data, {
        filter: (d) => d.segment_effect > 0,
        x: (d) => segment_label_function_2(d.segment),
        y: (d) => d.segment_compound_post,
        fill: (d) => d.segment_effect > 0,
        text: (d) => `${d3.format("+.1%")(d.segment_effect)}`,
        lineAnchor: "bottom",
        fontWeight: "bold",
        dy: -5
      }),
      // Steps
      Plot.ruleY(
        g_segment_data.concat([
          {
            volume_compound_pre:
              g_segment_data.slice(-1)[0].volume_compound_post
          }
        ]),
        {
          x1: (d, i) => x_domain[i],
          x2: (d, i) => x_domain[i + 1],
          y: "volume_compound_pre",
          strokeDasharray: "4,2"
        }
      ),
      Plot.ruleY(
        g_segment_data.concat([
          {
            segment_compound_pre:
              g_segment_data.slice(-1)[0].segment_compound_post
          }
        ]),
        {
          x1: (d, i) => x_domain.slice(-(g_segment_data.length + 2))[i],
          x2: (d, i) => x_domain.slice(-(g_segment_data.length + 2))[i + 1],
          y: "segment_compound_pre",
          strokeDasharray: "4,2"
        }
      )
    ]
  });
}

function calculateMixAdjustData(translated_data, extra) {
  const numerator = extra.measures[2].name;
  const denominator = extra.measures[1].name;
  // Data manipulations
  const cdata = translated_data
    .map((row) => ({
      ...row,
      category:
        (row.project_normalized == extra.selected_game &&
          row.period == "This Period" &&
          "main") ||
        (extra.selected_ref == row.project_normalized && "ref")
    }))
    .filter((f) => ["main", "ref"].includes(f.category));

  const data = cdata.map((row) => ({
    ...row
  }));

  const whole_data = {
    n_main: d3.sum(
      cdata.filter((f) => f.category == "main"),
      (d) => d[numerator]
    ),
    d_main: d3.sum(
      cdata.filter((f) => f.category == "main"),
      (d) => d[denominator]
    ),
    n_ref: d3.sum(
      cdata.filter((f) => f.category == "ref"),
      (d) => d[numerator]
    ),
    d_ref: d3.sum(
      cdata.filter((f) => f.category == "ref"),
      (d) => d[denominator]
    )
  };

  const segment_data = extra.dimensions[2].keys.map((s) => {
    const main_data = cdata.filter(
      (f) => f.category == "main" && f[extra.dimensions[2].name] == s
    );
    const ref_data = cdata.filter(
      (f) => f.category == "ref" && f[extra.dimensions[2].name] == s
    );

    const base_0 = {
      segment: s,
      d_main: d3.sum(main_data, (d) => d[denominator]),
      n_main: d3.sum(main_data, (d) => d[numerator]),
      d_ref: d3.sum(ref_data, (d) => d[denominator]),
      n_ref: d3.sum(ref_data, (d) => d[numerator])
      // ref_data,
      // main_data,
      // whole_data
    };

    const base_1 = {
      ...base_0,
      prop_main: base_0.d_main / whole_data.d_main,
      prop_ref: base_0.d_ref / whole_data.d_ref,
      measure_main: base_0.n_main / base_0.d_main,
      measure_ref: base_0.n_ref / base_0.d_ref
    };

    const base_2 = {
      ...base_1,
      volume_delta: base_1.prop_main - base_1.prop_ref,
      measure_delta: base_1.measure_main - base_1.measure_ref
    };

    const base_3 = {
      ...base_2,
      volume_effect: base_2.volume_delta * base_2.measure_main,
      segment_effect: base_2.measure_delta * base_2.prop_ref
    };

    return base_3;
  });

  const mix_adjusted_whole = {
    ...whole_data,
    n_mixadjusted: d3.sum(segment_data, (d) => d.n_ref * d.prop_main),
    d_mixadjusted: d3.sum(segment_data, (d) => d.d_ref * d.prop_main),
    rr_mixadjusted_compounded:
      whole_data.n_ref / whole_data.d_ref +
      d3.sum(segment_data, (d) => d.volume_effect)
  };

  const g_segment_data = segment_data.map((d, i) => ({
    ...d,
    volume_compound_pre: d3.cumsum([
      mix_adjusted_whole.n_ref / mix_adjusted_whole.d_ref,
      ...segment_data.map((cs) => cs.volume_effect)
    ])[i],
    volume_compound_post: d3.cumsum([
      mix_adjusted_whole.n_ref / mix_adjusted_whole.d_ref,
      ...segment_data.map((cs) => cs.volume_effect)
    ])[i + 1],
    segment_compound_pre: d3.cumsum([
      //mix_adjusted_whole.n_ref / mix_adjusted_whole.d_ref,
      mix_adjusted_whole.rr_mixadjusted_compounded,
      ...segment_data.map((cs) => cs.segment_effect)
    ])[i],
    segment_compound_post: d3.cumsum([
      //mix_adjusted_whole.n_ref / mix_adjusted_whole.d_ref,
      mix_adjusted_whole.rr_mixadjusted_compounded,
      ...segment_data.map((cs) => cs.segment_effect)
    ])[i + 1]
  }));
  return [g_segment_data, mix_adjusted_whole];
}

const get_options = function () {
    let vizOptions = {};

    let n_config = 4;

    // Main configs

    vizOptions['num_marks'] = {
        type: "number",
        section:"1. Marks",
        label: "Number of marks (max 15)",
        display: "number",
        display_size: 'normal',
        default: 1,
        order: n_config
    }

    n_config++;

    // X Axis customization

    vizOptions['x'] = {
        type: "string",
        section:"2. General",
        label: "X Customization",
        display: "text",
        default: "",
        display_size: 'normal',
        hidden: false,
        order: n_config
    }

    n_config++;

    // Y Axis customization

    vizOptions['y'] = {
        type: "string",
        section:"2. General",
        label: "Y Customization",
        display: "text",
        default: "",
        display_size: 'normal',
        hidden: false,
        order: n_config
    }

    n_config++;

    // facet

    vizOptions['facet'] = {
        type: "string",
        section:"2. General",
        label: "Facet",
        display: "text",
        default: "",
        display_size: 'normal',
        hidden: false,
        order: n_config
    }

    n_config++;

    // Layout

    vizOptions['layout'] = {
        type: "string",
        section:"2. General",
        label: "Layout customization",
        display: "text",
        default: "",
        display_size: 'normal',
        hidden: false,
        order: n_config
    }

    n_config++;

    // Style

    vizOptions['style'] = {
        type: "string",
        section:"2. General",
        label: "Style customization",
        display: "text",
        default: "",
        display_size: 'normal',
        hidden: false,
        order: n_config
    }

    n_config++;

    // Color

    vizOptions['color'] = {
        type: "string",
        section:"2. General",
        label: "Color customization",
        display: "text",
        default: "",
        display_size: 'normal',
        hidden: false,
        order: n_config
    }

    n_config++;

    // Extra parameters

    vizOptions['extra_params'] = {
        type: "string",
        section:"2. General",
        label: "Extra Parameters",
        display: "text",
        default: "",
        display_size: 'normal',
        placeholder: 'Will go into: extra, use ; as sep',
        hidden: false,
        order: n_config
    }

    n_config++;

    // Data

    vizOptions['data'] = {
        type: "string",
        section:"2. General",
        label: "Data increment",
        display: "text",
        default: "",
        display_size: 'normal',
        hidden: false,
        order: n_config
    }

    n_config++;

    // Tooltip 

    vizOptions['tooltip_options'] = {
        type: "string",
        section:"2. General",
        label: "Tooltip Options",
        display: "text",
        default: "",
        display_size: 'normal',
        hidden: false,
        order: n_config
    }

    n_config++;

    // Others

    vizOptions['others'] = {
        type: "string",
        section:"2. General",
        label: "Other configs",
        display: "text",
        default: "",
        display_size: 'normal',
        hidden: false,
        order: n_config
    }

    n_config++;

    // Live refresh

      vizOptions['liveupdate'] = {
        type: "boolean",
        section:"2. General",
        label: "Live Update?",
        display: "select",
        display_size: 'normal',
        hidden: false,
        default: false,
        order: n_config
    }

    n_config++;

    // Mark-specific configs
    for (let i = 1; i <=15; i++) {
        const markname = 'mark' + i + '_';
    
        vizOptions[markname + 'label'] = {
            type: "string",
            section:"1. Marks",
            label: "Mark #" + i + "----",
            display: "divider", // This string is arbitrary it's just choosing an option that doesn't exist
            display_size: 'half',
            hidden: false,
            order: n_config
        }

        n_config++;

        vizOptions[markname +  'show'] = {
            type: "boolean",
            section:"1. Marks",
            label: "Show?",
            display: "select",
            display_size: 'half',
            hidden: false,
            default: false,
            order: n_config
        }

        n_config++;

        vizOptions[markname +  'type'] = {
            type: "string",
            section:"1. Marks",
            label: "Type",
            display: "select",
            values: [
                {'Dot': 'dot'},
                {'Line':'line'},
                {'AreaY':'areaY'},
                {'AreaX':'areaX'},
                {'BarY':'barY'},
                {'BarX':'barX'},
                {'Text':'text'},
                {'TickX':'tickX'},
                {'TickY':'tickY'},
                {'Link':'link'},
                {'RuleX':'ruleX'},
                {'RuleY':'ruleY'},
                {'Cell':'cell'},
                {'Arrow':'arrow'},
                {'Vector':'vector'},
                {'Image':'image'},
                {'Frame':'frame'},
                {'Rect':'rect'},
                {'RectX':'rectX'},
                {'RectY':'rectY'},
                {'Tip':'tip'},
                {'Tree':'tree'},
                {'Raster':'raster'},
                {'GridX':'gridX'},
                {'GridY':'gridY'},
                {'Auto':'auto'},
                {'Crosshair':'crosshair'},
            ],
            display_size: 'normal',
            default: 'abs',
            hidden: false,
            order: n_config
        }

        n_config++;

        vizOptions[markname +  'config'] = {
            type: "string",
            section:"1. Marks",
            label: "Configuration",
            display: "text",
            default: "",
            display_size: 'normal',
            hidden: false,
            order: n_config
        }

        n_config++;

    }

    // Info tab is included in the config update part

    // Now the parameters tab

    vizOptions['num_params'] = {
      type: "number",
      section:"3. Params",
      label: "Number of params (max 5)",
      display: "number",
      display_size: 'normal',
      default: 1,
      order: n_config
  }

  n_config++;

    // Parameter-specific configs
    for (let i = 1; i <=5; i++) {
      const paramname = 'parameter' + i + '_';
  
      vizOptions[paramname + 'label'] = {
          type: "string",
          section:"3. Params",
          label: "Param #" + i + "---",
          display: "divider", // This string is arbitrary it's just choosing an option that doesn't exist
          display_size: 'half',
          hidden: false,
          order: n_config
      }

      n_config++;

      vizOptions[paramname +  'show'] = {
          type: "boolean",
          section:"3. Params",
          label: "Show?",
          display: "select",
          display_size: 'half',
          hidden: false,
          default: false,
          order: n_config
      }

      n_config++;

      vizOptions[paramname +  'viewlabel'] = {
          type: "string",
          section:"3. Params",
          label: "View Label",
          display: "text",
          default: "",
          display_size: 'half',
          hidden: false,
          order: n_config
      }

      n_config++;

      vizOptions[paramname +  'varname'] = {
          type: "string",
          section:"3. Params",
          label: "Var name",
          display: "text",
          default: "",
          display_size: 'half',
          hidden: false,
          order: n_config
      }

      n_config++;

      vizOptions[paramname +  'type'] = {
          type: "string",
          section:"3. Params",
          label: "Type",
          display: "select",
          values: [
              {'Radio': 'radio'},
          ],
          display_size: 'normal',
          default: 'radio',
          hidden: false,
          order: n_config
      }

      n_config++;

      vizOptions[paramname +  'config'] = {
          type: "string",
          section:"3. Params",
          label: "Configuration",
          display: "text",
          default: "",
          display_size: 'normal',
          hidden: false,
          order: n_config
      }

      n_config++;

  }
    
    return vizOptions;

}

const vis : VisualizationDefinition = {
    options: get_options(),
    // Set up the initial state of the visualization
    create(element, config) {
        // let root = element.appendChild(document.createElement("div"));
        // root.setAttribute("id", "root");


        // Insert a <style> tag with some styles we'll use later.
        element.innerHTML = `
        <style>
          .hello-world-vis {
            /* Vertical centering */
            height: 100%;
            display: flex;
            flex-direction: column;
            justify-content: center;
            text-align: center;
          }
          .hello-world-text-large {
            font-size: 72px;
          }
          .hello-world-text-small {
            font-size: 18px;
          }
        </style>
      `;

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
            const params : any = config_to_parameters(config);

            // Building the visuals
            const width = element.getBoundingClientRect().width;
            const height = element.getBoundingClientRect().height;

            // Function to transform string input into JS object
            const interpret_fun = function(input_string, in_data, extra, in_row=null, in_i=null) {
                const z = Function('return function(data,extra,row,i,Plot,d3) { return ({' + input_string + '}) }')();
                return z(in_data,extra,in_row,in_i,Plot,d3);
            };

            // Additional parameters
            // This iteration is to allow variables to be reused in definitions
            let extra = {measures, dimensions, pivots, width, height };
            params['extra_params'].split(';').forEach(p => Object.assign(extra, interpret_fun(p,translated_data,extra)));

            // Here is where whe should resolve the parameters
            const input_parameters = params['param_config'].map(d => ({...d, config_obj: interpret_fun(d.config,translated_data,extra)}))

            // SENDING TO CHART CONFIG
            const chart_config = {
              translated_data,
              interpret_fun,
              params,
              extra,
              width,
              height
            }

            // graph_node.node().append(addTooltips(Plot.plot(plot_arguments),tooltip_options));// Finally update the state with our new data
            this.chart = ReactDOM.render(
              <TestComponent 
                  chartConfig={chart_config}
                  params={input_parameters}
              />,
              this._textElement
            );

            doneRendering();

        }
    }
};


const options_update = function(config, vizObject,raw_data) {

    const mark_configs = ['label','show','type','config']
    
    const num_marks = config['num_marks'];

    let myOptions = vizObject.options;

    //// Marks configs
    for (let i = 1; i <= 15; i++) {
        const markname = 'mark' + i + '_';

        // At first remove all configs
        mark_configs.forEach(function(d, i) {
            myOptions[markname + d].hidden = true;
        })

        // And reactivate for marks within range selected
        if (i <= num_marks) {
          mark_configs.forEach(m => {myOptions[markname + m].hidden = false;})
        }
    }


    const params_configs = ['label','show','type','config','varname','viewlabel']
    
    const num_params = config['num_params'];

    //// Params configs
    for (let i = 1; i <= 5; i++) {
        const paramname = 'parameter' + i + '_';

        // At first remove all configs
        params_configs.forEach(function(d, i) {
            myOptions[paramname + d].hidden = true;
        })

        // And reactivate for marks within range selected
        if (i <= num_params) {
            params_configs.forEach(p => {myOptions[paramname + p].hidden = false;})
        }
    } 

    // Now adding the info part, that is only text to be shown

    const info_show_fun = d => d.name; //d.label + ":  "+ d.name;

    const info_objects = [
        ...((raw_data.dimensions.length == 0) ? [] : ['Dimensions:   ' + raw_data.dimensions.map(info_show_fun).join(', ')]),
        ...((raw_data.pivots.length == 0) ? [] : ['Pivots:   ' + raw_data.pivots.map(info_show_fun).join(', ')]),
        ...((raw_data.measures.length == 0) ? [] : ['Measures:   ' + raw_data.measures.map(info_show_fun).join(', ')]),
    ]

    info_objects.forEach(function(info, i) {
        myOptions['label_info_marks' + i] = {
            type: "string",
            section:"1. Marks",
            label: info,
            display: "divider", // This string is arbitrary it's just choosing an option that doesn't exist
            display_size: 'normal',
            hidden: false,
            order: i 
        };

        myOptions['label_info_general' + i] = {
            type: "string",
            section:"2. General",
            label: info,
            display: "divider", // This string is arbitrary it's just choosing an option that doesn't exist
            display_size: 'normal',
            hidden: false,
            order: i 
        }

        myOptions['label_info_parameters' + i] = {
            type: "string",
            section:"3. Params",
            label: info,
            display: "divider", // This string is arbitrary it's just choosing an option that doesn't exist
            display_size: 'normal',
            hidden: false,
            order: i 
        }
    })

    vizObject.trigger('registerOptions', myOptions);

    return myOptions;
};

// Reading configurations to parameters
function config_to_parameters(config) {
    
    const main_parameters = ['num_marks','x','y','facet','layout','style','color','data','extra_params','tooltip_options','liveupdate','others']

    let parameters = {};

    main_parameters.forEach(function(pm) {parameters[pm] = config[pm];});
    
    // Mark configs

    const n_marks = config['num_marks'];

    const mark_configs = ['show','type','config'];

    parameters['mark_config'] = [];

    for (let i = 1; i <= n_marks; i++) {
        const mark_name = 'mark' + i + '_';
        let mark_config = {};

        mark_configs.map(function(d) {
            mark_config[d] = config[mark_name + d]
        })

        parameters['mark_config'].push(mark_config);
    }

    // Param configs

    const n_params = config['num_params'];

    const param_configs = ['show','type','config','varname','viewlabel'];

    parameters['param_config'] = [];

    for (let i = 1; i <= n_params; i++) {
        const param_name = 'parameter' + i + '_';
        let param_config = {};

        param_configs.map(function(d) {
          param_config[d] = config[param_name + d]
        })

        parameters['param_config'].push(param_config);
    }

    return parameters;
};

//// From here we will write the tooltip addon functions

// Function to position the tooltip
const hover = (tip, pos, text) => {
    const side_padding = 10;
    const vertical_padding = 5;
    const vertical_offset = 15;
  
    // Empty it out
    tip.selectAll("*").remove();
  
    // Append the text
    tip
      .style("text-anchor", "middle")
      .style("pointer-events", "none")
      .attr("transform", `translate(${pos[0]}, ${pos[1] + 7})`)
      .selectAll("text")
      .data(text)
      .join("text")
      .style("dominant-baseline", "ideographic")
      .text((d) => d)
      .attr("y", (d, i) => (i - (text.length - 1)) * 15 - vertical_offset)
      .style("font-weight", (d, i) => (i === 0 ? "bold" : "normal"));
  
    const bbox = tip.node().getBBox();
  
    // Add a rectangle (as background)
    tip
      .append("rect")
      .attr("y", bbox.y - vertical_padding)
      .attr("x", bbox.x - side_padding)
      .attr("width", bbox.width + side_padding * 2)
      .attr("height", bbox.height + vertical_padding * 2)
      .style("fill", "white")
      .style("stroke", "#d3d3d3")
      .lower();
  }

const addTooltips = (chart, styles) => {
    const stroke_styles = { stroke: "blue", "stroke-width": 3 };
    const fill_styles = { fill: "blue", opacity: 0.5 };

    // Workaround if it's in a figure
    const type = d3.select(chart).node().tagName;
    let wrapper =
        type === "FIGURE" ? d3.select(chart).select("svg") : d3.select(chart);

    // Workaround if there's a legend....
    const svgs = d3.select(chart).selectAll("svg");
    if (svgs.size() > 1) wrapper = d3.select([...svgs].pop());
    wrapper.style("overflow", "visible"); // to avoid clipping at the edges

    // Set pointer events to visibleStroke if the fill is none (e.g., if its a line)
    wrapper.selectAll("path").each(function (data, index, nodes) {
        // For line charts, set the pointer events to be visible stroke
        if (
        d3.select(this).attr("fill") === null ||
        d3.select(this).attr("fill") === "none"
        ) {
        d3.select(this).style("pointer-events", "visibleStroke");
        if (styles === undefined) styles = stroke_styles;
        }
    });

    if (styles === undefined) styles = fill_styles;

    const tip = wrapper
        .selectAll(".hover")
        .data([1])
        .join("g")
        .attr("class", "hover")
        .style("pointer-events", "none")
        .style("text-anchor", "middle");

    // Add a unique id to the chart for styling
    const id = id_generator();

    // Add the event listeners
    d3.select(chart).classed(id, true); // using a class selector so that it doesn't overwrite the ID
    wrapper.selectAll("title").each(function () {
        // Get the text out of the title, set it as an attribute on the parent, and remove it
        const title = d3.select(this); // title element that we want to remove
        const parent = d3.select(this.parentNode); // visual mark on the screen
        const t = title.text();
        if (t) {
        parent.attr("__title", t).classed("has-title", true);
        title.remove();
        }
        // Mouse events
        parent
        .on("pointerenter pointermove", function (event) {
            const text = d3.select(this).attr("__title");
            const pointer = d3.pointer(event, wrapper.node());
            if (text) tip.call(hover, pointer, text.split("\n"));
            else tip.selectAll("*").remove();

            // Raise it
            d3.select(this).raise();
            // Keep within the parent horizontally
            const tipSize = tip.node().getBBox();
            if (pointer[0] + tipSize.x < 0)
            tip.attr(
                "transform",
                `translate(${tipSize.width / 2}, ${pointer[1] + 7})`
            );
            else if (pointer[0] + tipSize.width / 2 > wrapper.attr("width"))
            tip.attr(
                "transform",
                `translate(${wrapper.attr("width") - tipSize.width / 2}, ${
                pointer[1] + 7
                })`
            );
        })
        .on("pointerout", function (event) {
            tip.selectAll("*").remove();
            // Lower it!
            d3.select(this).lower();
        });
    });

    // Remove the tip if you tap on the wrapper (for mobile)
    wrapper.on("touchstart", () => tip.selectAll("*").remove());

    const html_string = `<style>
    .${id} .has-title { cursor: pointer;  pointer-events: all; }
    .${id} .has-title:hover { ${Object.entries(styles).map(([key, value]) => `${key}: ${value};`).join(" ")} }`;

    var htmlObject = document.createElement("style");
    htmlObject.innerHTML = html_string;          

    // Define the styles
    chart.appendChild(htmlObject);

    return chart;
}

// To generate a unique ID for each chart so that they styles only apply to that chart
const id_generator = () => {
    var S4 = function () {
      return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
    };
    return "a" + S4() + S4();
  }


looker.plugins.visualizations.add(vis);

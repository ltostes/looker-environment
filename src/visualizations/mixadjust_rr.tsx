import { Looker, VisualizationDefinition } from '../common/types';
import { handleErrors, d3formatType } from '../common/utils';
import { lookerDataTranslator } from '../common/data_translator';
// import './my-custom-viz.scss'

import { Radio, RadioGroup, FormControl, FormControlLabel, FormLabel, Container, Switch, Box, Grid, Typography } from '@mui/material';

import React from 'react'
import ReactDOM from 'react-dom'

import * as d3 from 'd3';
import * as Plot from "@observablehq/plot";

declare var looker: Looker;

function TestComponent({chartConfig}) {

  const params = [{
                    varname: "chosen_cohort",
                    viewlabel: "Comparison",
                    show: true,
                    type: 'radio',
                    config_obj: {list: chartConfig.extra.dimensions[0].keys, default: chartConfig.extra.dimensions[0].keys[0]}
                  },
                  {
                    varname: "collapse_volume_live",
                    viewlabel: "Collapse Volume Effect?",
                    show: chartConfig.extra.config.show_collapse_volume,
                    type: 'switch',
                    config_obj: {default: chartConfig.extra.config.collapse_volume_edit}
                  }
                  ];

  const initialParameters = Object.assign({},...params.map(p => ({[p.varname]:p.config_obj.default})));

  const [liveParameters, setLiveParameters] = React.useState(initialParameters);

  function handleParamUpdate(event, varname, type) {

    const updatedLiveParameters = ({...liveParameters});

    if (['radio'].includes(type)) {
      updatedLiveParameters[varname] = event.target.value;
    } else if (['switch'].includes(type)) {
      updatedLiveParameters[varname] = event.target.checked;
    }

    setLiveParameters(updatedLiveParameters);
  }

  const headerRef = React.useRef<HTMLInputElement>();

  React.useEffect(() => {

    const completedChartConfig = ({...chartConfig, extra: {...chartConfig.extra, ...liveParameters}});
    // const chart = buildChart(completedChartConfig);
    const chart = buildMixAdjustChart(completedChartConfig);
    headerRef.current.append(chart);

    return () => chart.remove();
  }, [chartConfig, liveParameters])

  return (
      <div>
        <Grid container spacing={1}>
          {
            params.map(p => 
                p.show && <Grid item xs>
                  {p.type =='radio' && 
                  
                      <FormControl>
                        {/* <FormLabel>{p.viewlabel}</FormLabel> */}
                        <RadioGroup
                          row
                          value={liveParameters[p.varname]}
                          onChange={(event) => handleParamUpdate(event,p.varname, p.type)}
                        >
                          {
                            p.config_obj.list.map(k => <FormControlLabel value={k} control={<Radio />} label={k} componentsProps={{typography: <Typography variant="body2"/>}} />)
                          }
                        </RadioGroup>
                      </FormControl>
                  }
                  {
                    p.type =='switch' && 
                      <FormControlLabel 
                          control={<Switch checked={liveParameters[p.varname]} />}
                          label={p.viewlabel} 
                          onChange={(event) => handleParamUpdate(event,p.varname, p.type)}
                      />
                  }

                </Grid>
              )
          }
        
        </Grid>
        <header className="App-header" ref={headerRef} />
      </div>
  )
}

function buildMixAdjustChart({ translated_data, extra, height, width }) {
  // Data calculations
  const { segments_data, main_data, volume_compound_data } = transformData({
    translated_data,
    extra
  });

  // Graph params
  const pp_margin = 0.01;
  const opacity_solid_bars = 0.6;
  const y_label = "RR 1";
  const tickformat = ".1%";
  const dash = "2,1";
  const show_originals = true;
  const tooltip_max_width = 15;
  const height_adjustment = 0.975;

  const collapse_volume_live = extra.collapse_volume_live;
  const show_collapse_volume = extra.config.show_collapse_volume;
  const collapse_volume_edit = extra.config.collapse_volume_edit;

  const single_volume_effect =
    (show_collapse_volume && collapse_volume_live) ||
    (!show_collapse_volume && collapse_volume_edit);

  const volume_effect_label = "\n\n Total Volume Effect";
  const volume_effect_tooltip = (d) =>
    `The variation in segment's shares represents an effect of ${d3.format(
      "+" + tickformat
    )(
      d.MixAdj_volume_segment_delta
    )} in ${y_label} before MixAdjustments. Individual contributions are:\n\n${segments_data
      .filter((f) => f.is_relevant_segment)
      .map(
        (s) =>
          `${s.segment}: ${d3.format("+" + tickformat)(
            s.MixAdj_volume_segment_delta
          )}`
      )
      .join("\n")}`;

  const zero = extra.config.zero;

  const unc_params = {};

  const main_game = translated_data
    .find((f) => f.cohort_name.includes("(Other Cohort)"))
    .cohort_name.split(" (")[0]
    .trim();
  const comparison_game = segments_data[0].cohort_name.trim();
  const unsignificant_segments = segments_data
    .filter((f) => !f.is_relevant_segment)
    .map((m) => m.segment);

  const main_infos = {
    rr1_original: {
      label: ` `,
      tooltip: `Original RR1 of ${comparison_game}. Insignificant segments are removed from calculations. \n\nExcluded segments: ${unsignificant_segments.join(
        ", "
      )}`
    },
    rr1_considering_relevant_segments: {
      label: `${comparison_game}`,
      tooltip: `RR1 of ${comparison_game} for comparison.`
    },
    rr1_mix_adjusted: {
      label: `Mix Adjusted`,
      tooltip: `Mix adjusted RR1 of ${comparison_game}`
    },
    REFERENCE_rr1_considering_relevant_segments: {
      label: `${main_game} (Reference)`,
      tooltip: `RR1 of ${main_game}.`
    },
    REFERENCE_rr1_original: {
      label: `  `,
      tooltip: `Original RR1 of ${main_game}. Insignificant segments are removed from calculations. \n\nExcluded segments: ${unsignificant_segments.join(
        ", "
      )}`
    }
  };

  // Graph preparations
  const g_segments_data = segments_data.filter((f) => f.is_relevant_segment);
  const g_main_data = main_data.map((d) => ({
    ...d,
    ...main_infos[d.key]
  }));

  const segment_domain = g_segments_data.map((d) => d.segment);
  const segment_label_function_1 = (d) =>
    single_volume_effect ? volume_effect_label : `\n\n${d}\n`;
  const segment_label_function_2 = (d) => `\n\n${d}\n\n`;

  const x_domain = [
    ...g_main_data
      .filter((f) => f.key == "rr1_original" && show_originals)
      .map((d) => d.label),
    ...g_main_data
      .filter((f) => f.key == "rr1_considering_relevant_segments")
      .map((d) => d.label),
    ...(single_volume_effect
      ? [volume_effect_label]
      : segment_domain.map(segment_label_function_1)),
    ...g_main_data
      .filter((f) => f.key == "rr1_mix_adjusted")
      .map((d) => d.label),
    ...segment_domain.map(segment_label_function_2),
    ...g_main_data
      .filter((f) => f.key == "REFERENCE_rr1_considering_relevant_segments")
      .map((d) => d.label),
    ...g_main_data
      .filter((f) => f.key == "REFERENCE_rr1_original" && show_originals)
      .map((d) => d.label)
  ];
  const x_domain_withindex = x_domain.map((d, i) => ({
    label: d,
    prev_label: i > 0 ? x_domain[i - 1] : 0,
    next_label: i < x_domain.length ? x_domain[i + 1] : x_domain.length,
    index: i
  }));

  const y_domain = [
    d3.min(
      [
        ...g_main_data.map((d) => [d.value, d.lower]),
        ...g_segments_data.map((d) => [
          d.volume_compound_post,
          d.segment_compound_post
        ])
      ].flat()
    ) - pp_margin,
    d3.max(
      [
        ...g_main_data.map((d) => [d.value, d.upper]),
        ...g_segments_data.map((d) => [
          d.volume_compound_post,
          d.segment_compound_post
        ])
      ].flat()
    ) + pp_margin
  ];

  // Finally plotting
  return Plot.plot({
    marginLeft: 80,
    marginRight: 40,
    width: width,
    height: height * height_adjustment,
    insetTop: 10,
    insetBottom: 10,
    marginBottom: 45,
    style: { fontSize: "13px", overflow: "visible" },
    x: {
      domain: x_domain,
      label: null
      // tickRotate: 90
    },
    y: {
      tickFormat: tickformat,
      nice: true,
      label: y_label,
      grid: true,
      zero: zero,
      domain: y_domain
    },
    color: {
      range: ["red", "green"]
    },
    marks: [
      // Whole bars
      Plot.barY(
        g_main_data.filter((f) => !f.key.includes("original")),
        {
          x: "label",
          y: "value",
          clip: true,
          opacity: opacity_solid_bars
        }
      ),
      // Whole bars labels
      Plot.text(
        g_main_data.filter((f) => !f.key.includes("original")),
        {
          x: "label",
          y: "value",
          text: (d) => `${d3.format(tickformat)(d.value)}`,
          dy: -10,
          lineAnchor: "bottom",
          fontWeight: "bold"
        }
      ),
      // "Original" value bars
      Plot.tickY(
        g_main_data.filter((f) => f.key.includes("original")),
        {
          x: "label",
          y: "value",
          clip: true,
          opacity: 0.3
          // stroke: "darkgrey"
        }
      ),
      // "Original" value labels
      Plot.text(
        g_main_data.filter((f) => f.key.includes("original")),
        {
          x: "label",
          y: "value",
          text: (d) => `${d3.format(tickformat)(d.value)}`,
          dy: -10,
          opacity: 0.5,
          lineAnchor: "bottom",
          fontWeight: "bold"
        }
      ),
      // Uncertainty
      Plot.tickY(g_main_data, {
        x: "label",
        y: "upper",
        strokeOpacity: 0.3,
        strokeDasharray: dash
      }),
      Plot.tickY(g_main_data, {
        x: "label",
        y: "lower",
        strokeOpacity: 0.3,
        strokeDasharray: dash,
        stroke: (d) => (d.key.includes("original") ? "black" : "white")
      }),
      Plot.text(g_main_data, {
        x: "label",
        y: "lower",
        text: (d) => `±${d3.format(tickformat)(1.96 * (d.upper - d.value))}`,
        fill: (d) => (d.key.includes("original") ? "black" : "white"),
        dy: 10,
        opacity: 0.5,
        lineAnchor: "top"
      }),
      // Volume effect bars
      Plot.barY(single_volume_effect ? volume_compound_data : g_segments_data, {
        x: (d) => segment_label_function_1(d.segment),
        y1: "volume_compound_pre",
        y2: "volume_compound_post",
        fill: (d) => d.MixAdj_volume_segment_delta > 0,
        opacity: opacity_solid_bars
      }),
      // Volume effect labels
      Plot.text(single_volume_effect ? volume_compound_data : g_segments_data, {
        filter: (d) => d.MixAdj_volume_segment_delta < 0,
        x: (d) => segment_label_function_1(d.segment),
        y: (d) => d.volume_compound_post,
        fill: (d) => d.MixAdj_volume_segment_delta > 0,
        text: (d) =>
          `${d3.format("+" + tickformat)(d.MixAdj_volume_segment_delta)}`,
        lineAnchor: "top",
        dy: 5
      }),
      Plot.text(single_volume_effect ? volume_compound_data : g_segments_data, {
        filter: (d) => d.MixAdj_volume_segment_delta > 0,
        x: (d) => segment_label_function_1(d.segment),
        y: (d) => d.volume_compound_post,
        fill: (d) => d.MixAdj_volume_segment_delta > 0,
        text: (d) =>
          `${d3.format("+" + tickformat)(d.MixAdj_volume_segment_delta)}`,
        lineAnchor: "bottom",
        dy: -5
      }),
      // Steps in volume bars
      Plot.ruleY(
        single_volume_effect ? volume_compound_data : g_segments_data,
        {
          y: "volume_compound_pre",
          x1: (d) =>
            x_domain_withindex.find(
              (f) => f.label == segment_label_function_1(d.segment)
            ).prev_label,
          x2: (d) => segment_label_function_1(d.segment),
          strokeDasharray: dash
        }
      ),
      Plot.ruleY(
        single_volume_effect ? volume_compound_data : g_segments_data.slice(-1),
        {
          y: "volume_compound_post",
          x1: (d) => segment_label_function_1(d.segment),
          x2: (d) =>
            x_domain_withindex.find(
              (f) => f.label == segment_label_function_1(d.segment)
            ).next_label,
          strokeDasharray: dash
        }
      ),
      // Segment effect bars
      Plot.barY(g_segments_data, {
        x: (d) => segment_label_function_2(d.segment),
        y1: "segment_compound_pre",
        y2: "segment_compound_post",
        fill: (d) => d.MixAdj_retention_segment_delta > 0,
        opacity: opacity_solid_bars
      }),
      // Segment effect labels
      Plot.text(g_segments_data, {
        filter: (d) => d.MixAdj_retention_segment_delta < 0,
        x: (d) => segment_label_function_2(d.segment),
        y: (d) => d.segment_compound_post,
        fill: (d) => d.MixAdj_retention_segment_delta > 0,
        text: (d) =>
          `${d3.format("+" + tickformat)(d.MixAdj_retention_segment_delta)}`,
        lineAnchor: "top",
        dy: 5
      }),
      Plot.text(g_segments_data, {
        filter: (d) => d.MixAdj_retention_segment_delta > 0,
        x: (d) => segment_label_function_2(d.segment),
        y: (d) => d.segment_compound_post,
        fill: (d) => d.MixAdj_retention_segment_delta > 0,
        text: (d) =>
          `${d3.format("+" + tickformat)(d.MixAdj_retention_segment_delta)}`,
        lineAnchor: "bottom",
        dy: -5
      }),
      // Steps in segment bars
      Plot.ruleY(g_segments_data, {
        y: "segment_compound_pre",
        x1: (d) =>
          x_domain_withindex.find(
            (f) => f.label == segment_label_function_2(d.segment)
          ).prev_label,
        x2: (d) => segment_label_function_2(d.segment),
        strokeDasharray: dash
      }),
      Plot.ruleY(g_segments_data.slice(-1), {
        y: "segment_compound_post",
        x1: (d) => segment_label_function_2(d.segment),
        x2: (d) =>
          x_domain_withindex.find(
            (f) => f.label == segment_label_function_2(d.segment)
          ).next_label,
        strokeDasharray: dash
      }),
      // Tips
      // Volume Performance tips
      //// Each tier tip (pos and neg)
      Plot.tip(
        single_volume_effect ? [] : g_segments_data,
        Plot.pointerX({
          x: (d) => segment_label_function_1(d.segment),
          py: null,
          y: (d) => d.volume_compound_post,
          dy: 20,
          anchor: "top",
          filter: (f) => f.MixAdj_volume_segment_delta < 0,
          title: (d) =>
            `${
              d.segment
            }'s difference in volume share contributed in ${d3.format(
              "+" + tickformat
            )(d.MixAdj_volume_segment_delta)} to the RR1 diference.`
        })
      ),
      Plot.tip(
        single_volume_effect ? [] : g_segments_data,
        Plot.pointerX({
          x: (d) => segment_label_function_1(d.segment),
          y: (d) => d.volume_compound_post,
          dy: -20,
          anchor: "bottom",
          filter: (f) => f.MixAdj_volume_segment_delta > 0,
          title: (d) =>
            `${
              d.segment
            }'s difference in volume share contributed in ${d3.format(
              "+" + tickformat
            )(d.MixAdj_volume_segment_delta)} to the RR1 diference.`
        })
      ),
      //// Single volume effect tip (pos and neg)
      Plot.tip(
        single_volume_effect ? volume_compound_data : [],
        Plot.pointerX({
          x: (d) => segment_label_function_1(d.segment),
          y: (d) => d.volume_compound_post,
          dy: 20,
          anchor: "top",
          filter: (f) => f.MixAdj_volume_segment_delta < 0,
          title: (d) => volume_effect_tooltip(d)
        })
      ),
      Plot.tip(
        single_volume_effect ? volume_compound_data : [],
        Plot.pointerX({
          x: (d) => segment_label_function_1(d.segment),
          y: (d) => d.volume_compound_post,
          dy: -20,
          anchor: "bottom",
          filter: (f) => f.MixAdj_volume_segment_delta > 0,
          title: (d) => volume_effect_tooltip(d)
        })
      ),
      // Segment Performance tips
      Plot.tip(
        g_segments_data,
        Plot.pointerX({
          x: (d) => segment_label_function_2(d.segment),
          y: (d) => d.segment_compound_post,
          dy: 20,
          anchor: "top",
          filter: (f) => f.MixAdj_retention_segment_delta < 0,
          title: (d) =>
            `${d.segment}'s RR1 performance contributed in ${d3.format(
              "+" + tickformat
            )(d.MixAdj_retention_segment_delta)} to the total diference.`
        })
      ),
      Plot.tip(
        g_segments_data,
        Plot.pointerX({
          x: (d) => segment_label_function_2(d.segment),
          y: (d) => d.segment_compound_post,
          dy: -20,
          anchor: "bottom",
          filter: (f) => f.MixAdj_retention_segment_delta > 0,
          title: (d) =>
            `${d.segment}'s RR1 performance contributed in ${d3.format(
              "+" + tickformat
            )(d.MixAdj_retention_segment_delta)} to the total diference.`
        })
      ),
      // Whole bars tip
      Plot.tip(
        g_main_data,
        Plot.pointerX({
          x: "label",
          y: "value",
          dy: -30,
          anchor: "bottom",
          title: "tooltip",
          lineWidth: tooltip_max_width
        })
      )
    ]
  });
}

function transformData({ translated_data, extra }) {
  // Hardcoded references
  const initial_volume_compound_label = "rr1_considering_relevant_segments";
  const initial_segment_compound_label = "rr1_mix_adjusted";
  const mix_adjusted_key = "rr1_mix_adjusted"; // To remove automatic calculation

  // Filtering only the cohort we want
  const fdata = translated_data.filter(
    (d) => d.cohort_name == extra.chosen_cohort
  );

  // Segment data
  const segments_keys = [
    "cohort_name",
    "segment",
    "is_relevant_segment",
    "MixAdj_volume_segment_delta",
    "MixAdj_retention_segment_delta"
  ];

  const segments_data_raw = fdata.map((d) =>
    Object.assign({}, ...segments_keys.map((k) => ({ [k]: d[k] })))
  );

  // Main bars data
  const main_data_keys = Object.keys(fdata[0]).filter(
    (f) =>
      !segments_keys.includes(f) &&
      !f.includes("_std") &&
      !(f == mix_adjusted_key)
  );

  const main_data_raw = main_data_keys.map((k) => ({
    key: k,
    label: typeof extra.label_dict == "undefined" ? k : extra.label_dict[k],
    show: typeof extra.label_dict == "undefined" ? true : extra.show_dict[k],
    value: fdata[0][k],
    upper: fdata[0][k] + 1.96 * fdata[0][`${k}_std`],
    lower: fdata[0][k] - 1.96 * fdata[0][`${k}_std`]
  }));

  // Middle bar object (mix adjusted with summed volume effect)
  const mix_adjusted_row = {
    key: mix_adjusted_key,
    label:
      typeof extra.label_dict == "undefined"
        ? mix_adjusted_key
        : extra.label_dict[mix_adjusted_key],
    show:
      typeof extra.label_dict == "undefined"
        ? true
        : extra.show_dict[mix_adjusted_key],
    value:
      main_data_raw.find((f) => f.key == initial_volume_compound_label).value +
      d3.sum(segments_data_raw, (d) => d.MixAdj_volume_segment_delta),
    upper: null, //fdata[0][k] + 1.96 * fdata[0][`${k}_std`], -- Not available
    lower: null //fdata[0][k] - 1.96 * fdata[0][`${k}_std`]  -- Not available
  };

  // Final main data with middle bar
  const main_data = main_data_raw.concat([mix_adjusted_row]);

  // Getting cumulative values for segments too
  const segments_data = segments_data_raw.map((d, i) => ({
    ...d,
    volume_compound_pre: d3.cumsum([
      main_data.find((f) => f.key == initial_volume_compound_label).value,
      ...segments_data_raw.map((s) => s.MixAdj_volume_segment_delta)
    ])[i],
    volume_compound_post: d3.cumsum([
      main_data.find((f) => f.key == initial_volume_compound_label).value,
      ...segments_data_raw.map((s) => s.MixAdj_volume_segment_delta)
    ])[i + 1],
    segment_compound_pre: d3.cumsum([
      main_data.find((f) => f.key == initial_segment_compound_label).value,
      ...segments_data_raw.map((s) => s.MixAdj_retention_segment_delta)
    ])[i],
    segment_compound_post: d3.cumsum([
      main_data.find((f) => f.key == initial_segment_compound_label).value,
      ...segments_data_raw.map((s) => s.MixAdj_retention_segment_delta)
    ])[i + 1]
  }));

  // Making the single volume compound option
  const volume_compound_data = [
    {
      volume_compound_pre: segments_data[0].volume_compound_pre,
      volume_compound_post: segments_data.slice(-1)[0].volume_compound_post,
      volume_contributions: segments_data.map(
        ({ segment, MixAdj_volume_segment_delta }) => ({
          segment,
          MixAdj_volume_segment_delta
        })
      ),
      MixAdj_volume_segment_delta: d3.sum(
        segments_data,
        (s) => s.MixAdj_volume_segment_delta
      )
    }
  ];

  // Aux
  const aux = {
    segment_domain: Array.from(d3.group(segments_data, (d) => d.segment).keys())
  };

  return { segments_data, main_data, volume_compound_data };
}

const vis : VisualizationDefinition = {
    options: {
      zero: {
        type: "boolean",
        label: "Force to zero?",
        display: "select",
        display_size: 'normal',
        default: true,
    },
    collapse_volume_edit: {
      type: "boolean",
      label: "Collapse volume effects? (if no toggle)",
      display: "select",
      display_size: 'normal',
      default: true,
    },
    show_collapse_volume: {
      type: "boolean",
      label: "Show Collapse volume toggle?",
      display: "select",
      display_size: 'normal',
      default: true,
    }
    }, // No options for now

    // Set up the initial state of the visualization
    create(element, config) {
        // let root = element.appendChild(document.createElement("div"));
        // root.setAttribute("id", "root");


        // Insert a <style> tag with some styles we'll use later.
        element.innerHTML = `
        <style>
          .main-vis {
            /* Vertical centering */
            height: 100%;
            display: flex;
            flex-direction: column;
            justify-content: center;
            text-align: center;
          }
        </style>
      `;

      // Create a container element to let us center the text.
      let container = element.appendChild(document.createElement("div"));
      container.className = "main-vis";

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

            // Now updating the options based on data available -- Not available for now
            // options_update(config, this, raw_data); 

            // Collecting all parameters configured to complement measures and pivot

            // Building the visuals
            const width = element.getBoundingClientRect().width;
            const height = element.getBoundingClientRect().height;

            const extra = {
              dimensions,
              measures,
              pivots,
              config
            }

            // SENDING TO CHART CONFIG
            const chart_config = {
              translated_data,
              extra,
              width,
              height
            }

            // graph_node.node().append(addTooltips(Plot.plot(plot_arguments),tooltip_options));// Finally update the state with our new data
            this.chart = ReactDOM.render(
              <TestComponent 
                  chartConfig={chart_config}
              />,
              this._textElement
            );

            doneRendering();

        }
    }
};

looker.plugins.visualizations.add(vis);

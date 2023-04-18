import { Looker, VisualizationDefinition } from '../common/types';
import { handleErrors, d3formatType } from '../common/utils';
import { lookerDataTranslator } from '../common/data_translator';
// import './my-custom-viz.scss'
import React from 'react'
import ReactDOM from 'react-dom'
import { DataGrid, GridRowsProp, GridColDef } from '@mui/x-data-grid';

import './portfolio-period-table.scss'
import * as d3 from 'd3'

declare var looker: Looker;

const vis = {
    id: 'some id', // id/label not required, but nice for testing and keeping manifests in sync
    label: 'Some Name',
    options: {
        title: {
            type: 'string',
            label: 'Title',
            display: 'text',
            default: 'Default Text'
        }
    },
    // Set up the initial state of the visualization
    create(element, config) {
        let root = element.appendChild(document.createElement("div"));
        root.setAttribute("id", "root");
    },
    // Render in response to the data or settings changing
    update(data, element, config, queryResponse) {
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
            
            debugger;
            const raw_data = lookerDataTranslator(queryResponse, data);

            const measures = raw_data.measures;
            const dimensions = raw_data.dimensions;
            const pivots = raw_data.pivots;

            const tdata = raw_data.data;
            
            // const tdata = lookerDataTranslator(queryResponse, data);
            // const column_width = 150;



            const baseSubColumns = dimensions.find(dim => dim.label == 'Period').keys.map((key) => ({
                key: key
            }));

            const calcSubColumns : {key: string, fun: Function, label: string}[] = [
                {
                    key: 'diff',
                    label: 'PoP',
                    fun: (v : any[]) => v[0] - v[1],
                }
            ];

            const colStandards : GridColDef = {
                field: null,
                width: 120,
                headerAlign: 'center',
                align: 'center',
                headerClassName: 'column-header-test',
                cellClassName: (params) => {
                        if (calcSubColumns.map(c => c.key).includes(params.field.split('-')[1])) {
                            // debugger;
                            const status = params.formattedValue.slice(0,1) == '+' ? 'positive' : 'negative';
                            return 'cell-test-' + status;
                        }
                        // debugger;
                        return 'cell-test';
                }
                    // clsx({
                    //     'header-cell-test' : params.colDef.field == 
                    // })
                // dim_key: per

            };

            const header_column: GridColDef = {
                // Game header column
                field:'row_key', 
                headerName: 'Project', 
                cellClassName: (params) => {
                    if (calcSubColumns.map(c => c.key).includes(params.field.split('-')[1])) {
                        // debugger;
                        return 'header-cell-test ' + params.formattedValue.slice(0,1) == '+' ? 'positive' : 'negative'
                    }
                    // debugger;
                    return 'header-cell-test';
                },
                width: 200
            };

            const tmetrics_columns: GridColDef[] = [
                // Base columns
                ...measures.map((mes) => baseSubColumns.map((subc) : GridColDef => ({
                        ...colStandards,
                        field: `${mes.name}-${subc.key}`,
                        headerName: `${subc.key}`, // `${mes.label} - ${subc.key}`,
                    })),
                ).flat(),
                // Calculated columns
                ...measures.map((mes) => calcSubColumns.map((calcc) : GridColDef => ({
                        ...colStandards,
                        field: `${mes.name}-${calcc.key}`,
                        headerName: `${calcc.label}`, // `${mes.label} - ${subc.key}`,
                    })),
                ).flat()
            ].sort((a,b) => a.field.split('-')[0] > b.field.split('-')[0] ? -1 : 1) // Workaround for the column groups

            const tcolumns: GridColDef[] = [
                header_column,
                ...tmetrics_columns
            ]
            // debugger;

            function cellValueGetter  (project, in_mes, subCol) {
                // debugger;

                function formatValue (value, signed=false) {
                    const looker_format = measures.find((mes) => mes.name == in_mes).looker_value_format;

                    if (looker_format) {
                        if (signed) {
                            const pp = d3formatType(looker_format).slice(-1) == '%';
                            if (pp) {
                                return (d3.format('+' + d3formatType(looker_format)) (value)).slice(0,-1) + 'pp'
                            }
                            return d3.format('+' + d3formatType(looker_format)) (value)
                        }
                        return d3.format(d3formatType(looker_format)) (value);
                    }
                    return value;
                }
                        
                // debugger;
                if (baseSubColumns.map(d => d.key).includes(subCol)) {
                    // Base column, just gets the value from the data
                    return formatValue(tdata.find((r) => ((r.project == project) && (r.period == subCol)))[in_mes]);
                }
                else if (calcSubColumns.map(d => d.key).includes(subCol)) {
                    // Calculated column
                    const subColObj = calcSubColumns.find(subc => subc.key == subCol);
                    const base_values_vector = tdata.filter((r) => ((r.project == project))).map(r => r[in_mes]);

                    const final_value = subColObj.fun(base_values_vector);

                    return formatValue(final_value, true);
                }
            }

            const trows : GridRowsProp = [
                ...dimensions.find(dim => dim.name === 'project').keys.map( (proj) => ({
                        id: proj,
                        row_key: proj,
                        ...Object.assign({},
                            ...tcolumns.filter(c => c.field != 'row_key')
                                       .map((col) => ({
                                [col.field] : cellValueGetter(proj, col.field.split('-')[0], col.field.split('-')[1])
                            })
                        ))
                    })
                )
            ];

            const column_groups = [
                {
                    groupId: ' ',
                    children: [{field: 'row_key'}]
                },
                ...measures.map((mes) => ({
                    groupId: mes.name,
                    children: [...baseSubColumns, ...calcSubColumns].map((subc) => ({
                        field: `${mes.name}-${subc.key}`
                    })),
                    headerName: `${mes.label}`,
                    headerClassName: 'group-header',
                }))
            ]

            // const test = formatType;

            // debugger;

            ReactDOM.render(
                <React.StrictMode>
                    <div style={{ height: '100%', width: '100%' }}>
                        <DataGrid 
                            experimentalFeatures={{ columnGrouping: true }}
                            rows={trows}
                            columns={tcolumns} 
                            columnGroupingModel={column_groups}
                            // sx={{
                            //     '.column-header-test' : headerStyles
                            // }}
                        />
                    </div>
                </React.StrictMode>,
                element
            );
        }
    }
};

looker.plugins.visualizations.add(vis);

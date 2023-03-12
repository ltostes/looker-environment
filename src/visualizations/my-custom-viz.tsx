import { Looker, VisualizationDefinition } from '../common/types';
import { handleErrors } from '../common/utils';
// import './my-custom-viz.scss'
import React from 'react'
import ReactDOM from 'react-dom'
import { DataGrid, GridRowsProp, GridColDef } from '@mui/x-data-grid';

declare var looker: Looker;

interface WhateverNameYouWantVisualization extends VisualizationDefinition {
    elementRef?: HTMLDivElement,
}

const rows: GridRowsProp = [
    { id: 1, col1: 'Hello', col2: 'World' },
    { id: 2, col1: 'DataGridPro', col2: 'is Awesome' },
    { id: 3, col1: 'MUI', col2: 'is Amazing' },
  ];
  
const columns: GridColDef[] = [
{ field: 'col1', headerName: 'Column 1', width: 150 },
{ field: 'col2', headerName: 'Column 2', width: 150 },
];

function TestTable() {
return (
    <div style={{ height: 300, width: '100%' }}>
    <DataGrid rows={rows} columns={columns} />
    </div>
);
}

const vis: WhateverNameYouWantVisualization = {
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

            


            // element.innerHTML = 'Hello MR HAAAANNNN!';


            ReactDOM.render(
                <React.StrictMode>
                    <TestTable/>
                </React.StrictMode>,
                element
            );
        }
    }
};

looker.plugins.visualizations.add(vis);

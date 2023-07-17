/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 * author: Kyle Jones
 * Date: 05/27/2021
 * Version: 1.0
 * Description: Client functions for Saved SQL Tool
 */

import * as currentRecord from 'N/currentRecord';
import * as url from 'N/url';

import { csv } from '../netsuite_modules/export-to-csv-excel-btn/index';

const SUBLIST_ID = 'results_sublist';

enum IDs {
  selectFolder = 'custpage_select_folder',
  sqlQuery = 'custpage_sql_query',
  queryTitle = 'custpage_query_title',
  saved = 'custpage_saved_query',
  pdfTemplate = 'custpage_pdf_template',
}

interface IRequestParams {
  sqlFileId?: string;
  tempSqlCacheId?: string;
  pdfTemplate?: string;
  [x: string]: string | undefined;
}

const pageInit = () => {
  addScrollListener();
  addEntryFieldStyle();
};

const addEntryFieldStyle = () => {
  const entryField = document.getElementById('custpage_sql_query') as HTMLTextAreaElement;
  if (!entryField) return;
  entryField.style.fontFamily = 'monospace';
  entryField.onkeydown = (e) => handleTabKey(e, entryField);
};

const handleTabKey = (e: KeyboardEvent, entryField: HTMLTextAreaElement) => {
  if (e.key == 'Tab') {
    e.preventDefault();
    const start = entryField.selectionStart;
    const end = entryField.selectionEnd;
    entryField.value = entryField.value.substring(0, start) + '\t' + entryField.value.substring(end);
    entryField.selectionStart = entryField.selectionEnd = start + 1;
  }
};

const exportToCsv = (): void => {
  const randomFileNum = Math.floor(Math.random() * 900000) + 100000;
  csv(SUBLIST_ID, `SQLExport${randomFileNum}.csv`);
};

const addScrollListener = () => {
  window.addEventListener('scroll', () => {
    const pageHeaderBottom = document.getElementById('div__header')?.getBoundingClientRect().bottom;
    const sublistLayerTop = document.getElementById(SUBLIST_ID + '_layer')?.getBoundingClientRect().top ?? 0;
    const sublistHeader = document.getElementById(SUBLIST_ID + 'header');
    if (pageHeaderBottom && sublistHeader) {
      const translateAmount = pageHeaderBottom - sublistLayerTop - 47;
      sublistHeader.style.transform = `translateY(${translateAmount > 0 ? translateAmount : 0}px)`;
    }
  });
};

const printPdf = (): void => {
  const searchParams = new URLSearchParams(window.location.href);
  const templateId = <string>currentRecord.get().getValue({ fieldId: IDs.pdfTemplate });
  const params: IRequestParams = {
    pdfTemplate: templateId,
  };
  searchParams.forEach((value, key) => {
    params[key] = value;
  });
  const pdfUrl = url.resolveScript({
    scriptId: 'customscript_saved_sql_sl',
    deploymentId: 'customdeploy_saved_sql_sl',
    params,
  });
  console.log(params);
  window.open(pdfUrl, '_blank');
};

const applyFilters = (fieldIds: string[]): void => {
  const rec = currentRecord.get();
  const url = new URL(window.location.href);
  const searchParams = url.searchParams;
  fieldIds.forEach((fieldId) => {
    const type = rec.getField({ fieldId })?.type;
    switch (type) {
      case 'date': {
        const value = String(rec.getText({ fieldId }));
        searchParams.set(fieldId, value);
        break;
      }
      case 'checkbox': {
        const value = rec.getValue({ fieldId });
        if (value) {
          searchParams.set(fieldId, 'T');
        } else {
          searchParams.delete(fieldId);
        }
        break;
      }
      default: {
        const value = String(rec.getValue({ fieldId }));
        searchParams.set(fieldId, value);
      }
    }
  });
  url.search = searchParams.toString();
  window.onbeforeunload = null;
  window.location.replace(url.toString());
};

pageInit();

export { applyFilters, exportToCsv, printPdf };

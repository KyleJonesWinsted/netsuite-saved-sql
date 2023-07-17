/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 * author: Kyle Jones
 * Date: 03/12/2021
 * Version: 1.0
 * Description: Loads a SQL file from the file cabinet, performs text replacement and displays in a list
 */

import * as cache from 'N/cache';
import * as error from 'N/error';
import * as file from 'N/file';
import * as log from 'N/log';
import * as query from 'N/query';
import * as redirect from 'N/redirect';
import * as render from 'N/render';
import * as runtime from 'N/runtime';
import { EntryPoints } from 'N/types';
import * as message from 'N/ui/message';
import * as ui from 'N/ui/serverWidget';
import * as url from 'N/url';

enum IDs {
  sqlQuery = 'custpage_sql_query',
  queryTitle = 'custpage_query_title',
  saved = 'custpage_saved_query',
  pdfTemplate = 'custpage_pdf_template',
}

interface IColumnTypes {
  [fieldId: string]: ui.FieldType;
}

interface IRequestParams {
  sqlFileId?: string;
  tempSqlCacheId?: string;
  pdfTemplate?: string;
  [x: string]: string | undefined;
}

interface IQueryResults {
  results: Record<string, unknown>[];
  filters: IParsedFilter[];
  templateId?: string;
}

interface IParsedFilter {
  fieldName: string;
  fieldType: string;
  fieldSource?: string;
}

/**
 * Definition of the Suitelet script trigger point.
 * @param {Object} ctx
 * @param {ServerRequest} ctx.request - Encapsulation of the incoming request
 * @param {ServerResponse} ctx.response - Encapsulation of the Suitelet response
 * @Since 2015.2
 */
const onRequest: EntryPoints.Suitelet.onRequest = (ctx: EntryPoints.Suitelet.onRequestContext) => {
  const startTime = new Date().getTime();

  try {
    if (ctx.request.method === 'GET') handleGet(ctx);
    if (ctx.request.method === 'POST') handlePost(ctx);
  } catch (err: any) {
    log.error('There was a problem', err);
    // if (!err.name || err.name !== 'MISSING_REQ_PARAMETER') {
    // notify(err, undefined, errOptions);
    // }
    ctx.response.write({ output: err.message });
  }

  const elapsedSeconds = (new Date().getTime() - startTime) / 1000;
  log.debug('Elapsed Time', `${elapsedSeconds} seconds`);
};

const handleGet = (ctx: EntryPoints.Suitelet.onRequestContext): void => {
  // Get parameters from URL and script deployment
  const parameters: IRequestParams = getParameters(ctx);
  const sqlContent = loadSqlContents(parameters);

  if (sqlContent) {
    // Get SQL file
    const queryResults = getQueryResults(parameters, sqlContent.queryText);
    if (parameters.pdfTemplate) {
      generatePdf(ctx, queryResults, parameters);
      return;
    } else {
      const form = createResultsPage(parameters, queryResults, sqlContent.queryTitle);
      ctx.response.writePage(form);
    }
  } else {
    const form = createNewSavedSqlPage();
    ctx.response.writePage(form);
  }
};

function loadSqlContents(params: IRequestParams): { queryText: string; queryTitle: string } | undefined {
  if (params.sqlFileId) {
    const sqlFile = getSqlFileContents(params.sqlFileId);
    return { queryText: sqlFile.fileContents, queryTitle: sqlFile.fileDescription };
  }
  if (params.tempSqlCacheId) {
    return getSqlCacheContents(params.tempSqlCacheId);
  }
  return;
}

function getSqlCacheContents(cacheId: string): { queryText: string; queryTitle: string } {
  const sqlCache = cache.getCache({ name: cacheId, scope: cache.Scope.PUBLIC });
  const queryText = sqlCache.get({ key: IDs.sqlQuery });
  const queryTitle = sqlCache.get({ key: IDs.queryTitle });
  if (!queryText || !queryTitle) {
    throw error.create({ name: 'MISSING_CACHE', message: `Could not find cache with key ${cacheId}` });
  }
  return { queryText, queryTitle };
}

const generatePdf = (ctx: EntryPoints.Suitelet.onRequestContext, queryResults: IQueryResults, params: IRequestParams): void => {
  if (!queryResults.templateId) return;
  log.debug('pdf query', queryResults);
  const outputPdf = render.create();
  replaceNullResults(queryResults);
  outputPdf.setTemplateByScriptId({ scriptId: queryResults.templateId.toUpperCase() });
  outputPdf.addCustomDataSource({
    alias: 'data',
    data: queryResults,
    format: render.DataSource.OBJECT,
  });
  log.debug('filters', params);
  outputPdf.addCustomDataSource({
    alias: 'filters',
    data: params,
    format: render.DataSource.OBJECT,
  });
  // Generate response including PDF file
  ctx.response.addHeader({
    name: 'Content-Type',
    value: 'application/pdf',
  });
  ctx.response.writeFile({ file: outputPdf.renderAsPdf(), isInline: true });
  return;
};

const replaceNullResults = (queryResults: IQueryResults): void => {
  queryResults.results.forEach((res) => {
    Object.keys(res).forEach((key) => {
      if (res[key] === null) res[key] = '';
    });
  });
};

const handlePost = (ctx: EntryPoints.Suitelet.onRequestContext): void => {
  const parameters = getParameters(ctx);
  log.audit('post params', parameters);
  const sqlContent = loadSqlContents(parameters);
  if (sqlContent) {
    const newFileId = saveNewSqlFile(sqlContent);
    const form = createConfirmationPage(newFileId);
    ctx.response.writePage(form);
  } else {
    const cacheId = storeSqlContent(parameters);
    const suitelet = runtime.getCurrentScript();
    const redirectParams: IRequestParams = { tempSqlCacheId: cacheId };
    redirect.toSuitelet({
      deploymentId: suitelet.deploymentId,
      scriptId: suitelet.id,
      parameters: redirectParams,
    });
  }
};

const storeSqlContent = (params: IRequestParams): string => {
  const cacheId = generateUUID();
  const sqlCache = cache.getCache({ name: cacheId, scope: cache.Scope.PUBLIC });
  const store = (key: IDs) => sqlCache.put({ key, value: params[key] ?? '' });
  store(IDs.sqlQuery);
  store(IDs.queryTitle);
  return cacheId;
};

const createNewSavedSqlPage = (): ui.Form => {
  const form = ui.createForm({ title: 'New Saved SQL' });
  form //
    .addField({ id: IDs.sqlQuery, label: 'SQL Query Text', type: ui.FieldType.LONGTEXT })
    .updateLayoutType({ layoutType: ui.FieldLayoutType.NORMAL })
    .updateDisplaySize({ height: 10, width: 100 }).isMandatory = true;
  form //
    .addField({ id: IDs.queryTitle, label: 'Query Title', type: ui.FieldType.TEXT })
    .updateLayoutType({ layoutType: ui.FieldLayoutType.ENDROW })
    .updateDisplaySize({ height: 10, width: 75 }).isMandatory = true;
  form.addSubmitButton({ label: 'Preview' });
  form.clientScriptModulePath = './saved_sql_cl.js';
  return form;
};

const sqlFileFolder = () => {
  const folderId = <string>runtime.getCurrentScript().getParameter({ name: 'custscript_sql_file_folder' }) ?? findDefaultFolder();
  if (!folderId) {
    throw error.create({ name: 'MISSING_SQL_FOLDER', message: 'Missing SQL File Folder script parameter' });
  }
  return folderId;
};

function findDefaultFolder(): number | undefined {
  const scriptId = runtime.getCurrentScript().id;
  return query
    .runSuiteQL({
      query: /*sql*/ `
        SELECT sqlfolder.id
        FROM
          script
          JOIN file ON file.id = script.scriptfile
          JOIN mediaitemfolder AS scriptfolder
            ON scriptfolder.id = file.folder
          JOIN mediaitemfolder AS sqlfolder
            ON sqlfolder.appfolder = scriptfolder.appfolder || ' : Saved Queries'
        WHERE script.scriptid = '${scriptId}'
      `,
    })
    .asMappedResults<{ id: number }>()[0]?.id;
}

const parsePdfTemplateId = (fileText: string): { fileText: string; templateId?: string } => {
  const regex = /{% pdftemplate (\S+) %}/;
  const results = regex.exec(fileText);
  if (!results) return { fileText };
  const templateId = results[1];
  fileText = fileText.replace(regex, '');
  return { fileText, templateId };
};

const getQueryResults = (parameters: IRequestParams, fileContents: string): IQueryResults => {
  const { fileText, templateId } = parsePdfTemplateId(fileContents);

  const filters = parseFiltersFromQuery(fileText);

  // Replace file text with parameter values
  const sqlQuery = replaceFileVariables(fileText, parameters);

  // Run Query
  const results: Record<string, unknown>[] = [];

  if (parameters.runPaged) {
    query
      .runSuiteQLPaged({ query: sqlQuery, pageSize: 1000 })
      .iterator()
      .each((page) => {
        log.debug('page', page);
        results.push(...page.value.data.asMappedResults());
        return true;
      });
  } else {
    results.push(...query.runSuiteQL({ query: sqlQuery }).asMappedResults());
  }
  return { results, filters, templateId };
};

const createResultsPage = (parameters: IRequestParams, queryResults: IQueryResults, pageTitle: string): ui.Form => {
  const { results, filters, templateId } = queryResults;
  // Create Suitelet Page
  const form = ui.createForm({ title: pageTitle || 'Query Results' });
  addFilters(form, filters, parameters);
  if (results.length > 0) {
    const columnNames = Object.keys(results[0]);
    const columnTypes = getColumnTypes(results);
    const resultsSublist = createResultsSublist(form, columnNames, columnTypes);
    populateSublist(resultsSublist, columnNames, results);
    addPrintButton(form, resultsSublist, templateId);
  }
  if (parameters.tempSqlCacheId) {
    form.addSubmitButton({ label: 'Save' });
  }
  form.clientScriptModulePath = './saved_sql_cl.js';

  return form;
};

const addPrintButton = (form: ui.Form, sublist: ui.Sublist, templateId?: string): void => {
  if (templateId) {
    sublist.addButton({
      label: 'Print PDF',
      functionName: 'printPdf',
      id: 'custpage_print_pdf',
    });
    form.addField({ id: IDs.pdfTemplate, label: 'PDF Template', type: ui.FieldType.TEXT }).updateDisplayType({ displayType: ui.FieldDisplayType.HIDDEN }).defaultValue = templateId;
  }
};

/**
 * Determine Netsuite column types for mapped query results
 * @param queryResults - Array of objects containing mapped query results
 * @returns Object containing netsuite field type for each key in query results
 */
const getColumnTypes = (queryResults: any[]): IColumnTypes => {
  const columnTypes: IColumnTypes = {};
  const columnKeys = Object.keys(queryResults[0]);
  for (const key of columnKeys) {
    const nonNullValues = queryResults.filter((res) => res[key] !== undefined && res[key] !== null);
    columnTypes[key] = nonNullValues.length > 0 && typeof nonNullValues[0][key] === 'number' ? ui.FieldType.FLOAT : ui.FieldType.TEXT;
  }
  return columnTypes;
};

/**
 * Add fields and Apple Filter button to Suitelets to allow user to filter query results.
 * @param form - Suitelet page to add filters to
 * @param filters - Array of objects containing filter name, field type, and optional source (select fields only)
 * @param parameters - Suitelet request parameters, used to default filter field values
 */
const addFilters = (form: ui.Form, filters: IParsedFilter[], parameters: IRequestParams) => {
  filters.forEach((filter) => {
    const filterField = form.addField({
      id: filter.fieldName,
      label: filter.fieldName.replace(/_/g, ' '),
      type: filter.fieldType,
      source: filter.fieldSource,
    });
    if (parameters[filter.fieldName]) {
      filterField.defaultValue = <string>parameters[filter.fieldName];
    }
  });
  if (filters.length > 0) {
    form.addButton({
      label: 'Apply Filters',
      id: 'custpage_apply_filters',
      functionName: `applyFilters([${filters.map((f) => `'${f.fieldName}'`).join(',')}])`,
    });
  }
};

/**
 * Parses SQL string for filters to add to Suitelet page
 * @param text - string to parse filters from
 * @returns - object containing filter name, type, and optional source (select fields only)
 */
const parseFiltersFromQuery = (text: string): IParsedFilter[] => {
  const regex = /{% if (\S+) (\S+) %}/g;
  const resultIndices = {
    filterKey: 1,
    fieldType: 2,
  };
  const parsedFilters: IParsedFilter[] = [];
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const results = regex.exec(text);
    if (!results) break;
    const matchingFilters = parsedFilters.filter((filter) => filter.fieldName === results[resultIndices.filterKey]);
    if (matchingFilters.length > 0) continue;
    const fieldTypeSource = results[resultIndices.fieldType].split('|');
    parsedFilters.push({
      fieldName: results[resultIndices.filterKey],
      fieldType: fieldTypeSource[0],
      fieldSource: fieldTypeSource[1] ?? undefined,
    });
  }
  return parsedFilters;
};

/**
 * Replaces strings in double braces {{ }} with associated value for the key inside the braces
 * Example:
 * text = 'This is a {{testKey}}'
 * replacements = { testKey: 'Test' };
 * return value = 'This is a Test'
 * @param text - string containing text to be replaced
 * @param replacements - object where keys = text to replace without braces and values = replacement text
 * @returns - text string with all expressions replaced
 */
const replaceFileVariables = (text: string, replacements: IRequestParams): string => {
  for (const key of Object.keys(replacements)) {
    text = text.replace(new RegExp(`{{${key}}}`, 'g'), <string>replacements[key]);
  }
  text = replaceFileConditions(text, replacements);
  return text;
};

/**
 * Replaces if conditions based on existence of filter name in replacements
 * Example:
 *  text = `
 *    {% if testKey text %}
 *    FIRST BLOCK
 *    {% else %}
 *    SECOND BLOCK
 *    {% endif %}
 *  `
 *  replacements = { testKey: 'Test' }
 *  return value = 'FIRST BLOCK'
 * @param text - string containing text to be replaced
 * @param replacements - object where keys = text to replace and values = replacement text
 * @returns - text string with all expressions replaced
 */
const replaceFileConditions = (text: string, replacements: IRequestParams): string => {
  const regex = /{% if (\S+) (\S+) %}((?:(?!{%)[\S\s])+){% else %}((?:(?!{%)[\S\s])+){% endif %}/g;
  const resultIndices = {
    filterKey: 1,
    fieldType: 2,
    first: 3,
    second: 4,
  };
  let nullCount = 0;
  while (nullCount < 2) {
    const results = regex.exec(text);
    if (!results) {
      ++nullCount;
      continue;
    }
    nullCount = 0;
    const matchLength = results[0].length;
    text =
      text.substr(0, results.index) +
      (replacements[results[resultIndices.filterKey]] ? padWithWhitespace(results[resultIndices.first], matchLength) : padWithWhitespace(results[resultIndices.second], matchLength)) +
      text.substr(results.index + results[0].length);
  }
  return text;
};

const padWithWhitespace = (text: string, length: number) => {
  while (text.length < length) {
    text = text + ' ';
  }
  return text;
};

/**
 * Adds each row from SuiteQL query to a sublist
 * @param sublist - form sublist object to add rows to
 * @param columnNames - keys to each SuiteQL query result, used to select sublist field and index results object
 * @param results - array of object representing each mapped result from SuiteQL query
 */
const populateSublist = (sublist: ui.Sublist, columnNames: string[], results: { [x: string]: any }): void => {
  for (let line = 0; line < results.length; ++line) {
    for (const columnName of columnNames) {
      const value = String(results[line][columnName]);
      sublist.setSublistValue({
        id: sanitizeColumnName(columnName, 'id'),
        value: value.length > 300 ? value.substring(0, 297) + '...' : value, // Truncate if result is too long
        line,
      });
    }
  }
};

/**
 * Creates a sublist object with passed column names automatically sanitized
 * @param form - Form object to add sublist to
 * @param columnNames - strings to set column IDs and labels
 * @returns - Sublist object with columns and export to CSV button
 */
const createResultsSublist = (form: ui.Form, columnNames: string[], columnTypes: IColumnTypes): ui.Sublist => {
  const sublistId = 'results_sublist';
  const resultsSublist = form.addSublist({ id: sublistId, label: 'Results', type: ui.SublistType.LIST });
  resultsSublist.addButton({ id: 'custpage_export_csv', label: 'Export CSV', functionName: 'exportToCsv' });
  for (const columnName of columnNames) {
    resultsSublist.addField({
      id: sanitizeColumnName(columnName, 'id'),
      label: sanitizeColumnName(columnName, 'label'),
      type: columnTypes[columnName],
    });
  }
  return resultsSublist;
};

/**
 * Removes any characters from a string which are illegal in a Netsuite field label or ID
 * @param name - string to sanitize
 * @param type - Indicates whether to sanitize for a field label or ID
 * @returns - Sanitized string
 */
const sanitizeColumnName = (name: string, type: 'label' | 'id'): string => {
  const regex = type === 'label' ? /[^\w|\s]/g : /[^\w]/g;
  return name.replace(regex, '');
};

/**
 * Fetches the contents and description of a file in the File Cabinet
 * @param sqlFileId - internal ID of file in Netsuite File Cabinet
 * @returns - Object containing text content of file and file record description
 */
const getSqlFileContents = (sqlFileId: string): { fileContents: string; fileDescription: string } => {
  const sqlFile = file.load({ id: sqlFileId });
  if (!sqlFile) throw error.create({ name: 'FILE_NOT_FOUND', message: 'Could not find SQL file for id: ' + sqlFileId });
  return { fileContents: sqlFile.getContents(), fileDescription: sqlFile.description };
};

/**
 * Fetches URL paremeters and default parameters from script deployment
 * If there is a conflict, the default parameters take priority
 * @param ctx - Suitelet execution context object
 * @returns - Object containing both URL Parameters and Default Parameters set on script deployment
 */
const getParameters = (ctx: EntryPoints.Suitelet.onRequestContext): IRequestParams => {
  let parameters = {} as IRequestParams;
  const defaultParams = <string>runtime.getCurrentScript().getParameter({ name: 'custscript_default_parameters' });
  if (defaultParams) {
    parameters = JSON.parse(defaultParams);
  }
  const urlParameters: Record<string, unknown> = ctx.request.parameters;
  const urlSearch = urlParameters.entryformquerystring as string | undefined;
  log.debug('urlsearch', { urlSearch, urlParameters });
  if (urlSearch) {
    urlSearch
      .split('&')
      .map((pair: string) => pair.split('='))
      .forEach(([key, value]) => {
        urlParameters[key] = value;
      });
  }
  urlParameters.script = undefined;
  urlParameters.deploy = undefined;
  urlParameters.whence = undefined;
  urlParameters.compid = undefined;
  for (const [key, value] of Object.entries(urlParameters)) {
    log.debug('value', { key, value });
    const newKey = key //
      .replace(/:/g, '')
      .replace(/\//g, '')
      .replace(/\?/g, '');
    parameters[newKey] = value as any;
  }
  // parameters = { ...urlParameters, ...parameters };
  return parameters;
};

function createConfirmationPage(newFileId: number) {
  const form = createNewSavedSqlPage();
  const newUrl = url.resolveScript({
    deploymentId: runtime.getCurrentScript().deploymentId,
    scriptId: runtime.getCurrentScript().id,
    params: {
      sqlFileId: newFileId,
    },
  });
  form.addPageInitMessage({
    type: message.Type.CONFIRMATION,
    title: 'Saved SQL Query',
    message: `Your new query can be run any time using <a href="${newUrl}" target="_blank">this link</a>`,
  });
  return form;
}

function saveNewSqlFile(sqlContent: { queryText: string; queryTitle: string }) {
  const { queryText, queryTitle } = sqlContent;
  const newFileId = file
    .create({
      fileType: file.Type.PLAINTEXT,
      name: queryTitle,
      contents: queryText,
      folder: Number(sqlFileFolder()),
      description: queryTitle,
    })
    .save();
  return newFileId;
}

function generateUUID(): string {
  let d = new Date().getTime();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    let r = Math.random() * 16;
    // eslint-disable-next-line no-bitwise
    r = (d + r) % 16 | 0;
    d = Math.floor(d / 16);
    // eslint-disable-next-line no-bitwise
    return (c == 'x' ? r : (r & 0x7) | 0x8).toString(16);
  });
}

export { onRequest };

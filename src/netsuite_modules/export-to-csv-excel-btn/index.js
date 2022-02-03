/**
 * @NApiVersion 2.x
 * @NModuleScope SameAccount
 * author: Jon Lamb
 *         Nathan Fiedler
 * Date: 07/11/2019
 *       04/06/2020
 * Version: 1.0
 *          1.1 Added options
 */
var __spreadArrays = (this && this.__spreadArrays) || function () {
  for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
  for (var r = Array(s), k = 0, i = 0; i < il; i++)
    for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
      r[k] = a[j];
  return r;
};
define(["require", "exports", "N/currentRecord", "../FileSaver/FileSaver.min", "../PapaParse/papaparse.min", "../xlsx/xlsx.core.min"], function (require, exports, currentRecord, saveAs, papaParse, xlsx) {
  Object.defineProperty(exports, "__esModule", { value: true });
  function csv(sublistId, fileName, options) {
    var excludeFields = options ? options.excludeFields || [] : [];
    var onlyMarked = options ? options.onlyMarked || false : false;
    var _a = getRowData(sublistId, excludeFields, onlyMarked), headers = _a.headers, rows = _a.rows;
    var finalCSV = papaParse.unparse({ fields: headers, data: rows });
    var csvBlob = new Blob([finalCSV], { type: 'text/plain;charset=utf-8' });
    saveAs(csvBlob, fileName);
  }
  exports.csv = csv;
  function excel(sublistId, fileName, options) {
    var excludeFields = options ? options.excludeFields || [] : [];
    var onlyMarked = options ? options.onlyMarked || false : false;
    var _a = getRowData(sublistId, excludeFields, onlyMarked), headers = _a.headers, rows = _a.rows;
    var rowsCompleted = __spreadArrays([headers], rows);
    var wb = xlsx.utils.book_new();
    var ws = xlsx.utils.aoa_to_sheet(rowsCompleted);
    xlsx.utils.book_append_sheet(wb, ws);
    xlsx.writeFile(wb, fileName);
  }
  exports.excel = excel;
  function getRowData(sublistId, excludeFields, onlyMarked) {
    var rec = currentRecord.get();
    var count = rec.getLineCount({ sublistId: sublistId });
    var rows = [];
    var headers = [];
    document.querySelectorAll("#" + sublistId + "header > td")
      // .forEach(function (parentNode) { return headers.push(parentNode.childNodes[0].textContent.trim()); });
      .forEach(function (parentNode) {
        var excludeField = excludeFields.find(obj => obj.label === parentNode.childNodes[0].textContent.trim()) || {};
        if (Object.getOwnPropertyNames(excludeField).length === 0) {
          return headers.push(parentNode.childNodes[0].textContent.trim());
        }
      });
    for (var i = 0; i < count; i++) {
      var isMarked = onlyMarked ? rec.getSublistValue({ sublistId: sublistId, fieldId: 'mark', line: i }) : false;
      if (!onlyMarked || (onlyMarked && isMarked)) {
        var rowData = [];
        for (var _i = 0, headers_1 = headers; _i < headers_1.length; _i++) {
          var header = headers_1[_i];
          var excludeField = excludeFields.find(obj => obj.id === header.replace(/\s|\W/g, '').toLowerCase()) || {};
          if (Object.getOwnPropertyNames(excludeField).length === 0) {
            var uncleanHtml = rec.getSublistText({ sublistId: sublistId, fieldId: header.replace(/\s|\W/g, '').toLowerCase(), line: i });
            uncleanHtml = uncleanHtml ? uncleanHtml : rec.getSublistValue({
              sublistId: sublistId,
              fieldId: header.replace(/\s|\W/g, '').toLowerCase(),
              line: i,
            });
            var sanitizedHtml = createElementFromHTML(uncleanHtml);
            rowData.push(sanitizedHtml);
          }
        }
        rows.push(rowData);
      }
    }
    return { rows: rows, headers: headers };
  }
  function createElementFromHTML(htmlString) {
    if (typeof htmlString !== 'string')
      return htmlString;
    var div = document.createElement('div');
    div.innerHTML = htmlString.trim();
    if (!div.childNodes)
      return htmlString;
    var innerText = [];
    div.childNodes.forEach(function (node) { return innerText.push(node.textContent); });
    return innerText.join(' ');
  }
});
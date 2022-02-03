# Netsuite Saved SQL Reports

A suitelet to display, export, and print the results of a SuiteQL query from the File Cabinet

## Installation

1. Create a folder in the File Cabinet where you would like to store SQL queries created from this Suitelet.

2. Run the following command in your SDF project folder to install the module files

```
npx https://github.com/KyleJonesWinsted/netsuite-saved-sql
```

3. The installation script will ask you for the internal ID of the folder you created.

4. When installation is finished, a `deploy.xml` file will be created for you. Simply run project deployment and you are finished!

## Usage

1. Enter the desired title of the results page in the `Query Title` field. 

2. Enter the SQL query to be run in the `SQL Query Text` field.

3. Click `Preview` to view the results of your query

4. If you are happy with the results, click `Save`. 

5. A SQL file will be saved in the File Cabinet in the folder you entered during installation.

6. A message will appear, providing you with a reuseable link to run your SQL query anytime.


## Secret syntax

_Here be dragons_

### Interactive filters

This syntax was created by me, inspired by [Jinja2](https://jinja.palletsprojects.com/en/3.0.x/templates/), to allow me to add saved-search-like filters to my Suitelet that displays the results of an arbitrary SuiteQL query.

There are two types of expressions:

1. Anything inside double curly braces is replaced with it's provided value.

2. An if-else expression is replaced with it's first branch if the variable has a value, or the second branch if the variable doesn't exist. The else block is required even if it is empty.

    - The first word in the `if` block is the filter name and the second word is the Netsuite field type.

    - If you use the `select` or `multiselect` field types, you must provide a record type after a pipe symbol `|`. For example, `select|employee` creates a select field to pick from a list of employee records.


Example Input:
```sql
SELECT firstname

FROM employee

{% if last_name text %}

WHERE lastname = {{last_name}}

{% else %}

WHERE lastname IS NOT NULL

{% endif %}
```

Output if last_name = 'Jones':
```sql
SELECT firstname

FROM employee

WHERE lastname = 'Jones'
```

Output if last_name is undefined:
```sql
SELECT firstname

FROM employee

WHERE lastname IS NOT NULL
```

### PDF Printing

You can enable printing results as a PDF by including the following at the top of your SQL file, replacing \<template-id> with the script ID of an Advanced HTML/PDF template.

```
{% pdftemplate <template-id> %}
```

The data from the query will be provided to your template with the following objects.

```ts
type data = {
  results: Array<object>; // Your query results as and array of objects with the column names as the keys. Same as .asMappedResults() from the N/query module
  filters: Array<{
    fieldName: string;
    fieldType: string;
    fieldSource: string;
  }>; // The available filters used in your query. Filter values are provided separately
  templateId?: string; // The Script ID of the provided PDF template
}
type filters = {
  sqlFileId: string; // The internal ID of the SQL file being run
  pdfTemplate: string; // The script ID of the provided PDF template
  [key: string]: string; // Any other key/value pairs in the current URL. This is where you will find the current filter values.
}
```

These objects can be used as follows:

```xml
<#list data.results as result>
  <!-- Query results available as keys on result variable -->
  <tr>
    <td>${result.foo}</td>
  </tr>
</#list>

<!-- Filter values can be accessed directly on filters object -->
<td>${filters.bar}</td>

```



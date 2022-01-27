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


declare function csv(sublistId: string, fileName: string, options?: { excludeFields?: Array<{ id: string, label: string }>, onlyMarked?: boolean }): void;

declare function excel(sublistId: string, fileName: string, options?: { excludeFields?: Array<{ id: string, label: string }>, onlyMarked?: boolean }): void;

export { csv, excel };

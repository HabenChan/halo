/* tslint:disable */
/* eslint-disable */
/**
 * Halo
 * No description provided (generated by Openapi Generator https://github.com/openapitools/openapi-generator)
 *
 * The version of the OpenAPI document: 2.20.0-SNAPSHOT
 * 
 *
 * NOTE: This class is auto generated by OpenAPI Generator (https://openapi-generator.tech).
 * https://openapi-generator.tech
 * Do not edit the class manually.
 */



/**
 * 
 * @export
 * @interface AddOperation
 */
export interface AddOperation {
    /**
     * 
     * @type {string}
     * @memberof AddOperation
     */
    'op': AddOperationOpEnum;
    /**
     * A JSON Pointer path pointing to the location to move/copy from.
     * @type {string}
     * @memberof AddOperation
     */
    'path': string;
    /**
     * Value can be any JSON value
     * @type {any}
     * @memberof AddOperation
     */
    'value': any;
}

export const AddOperationOpEnum = {
    Add: 'add'
} as const;

export type AddOperationOpEnum = typeof AddOperationOpEnum[keyof typeof AddOperationOpEnum];



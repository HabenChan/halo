/* tslint:disable */
/* eslint-disable */
/**
 * Halo
 * No description provided (generated by Openapi Generator https://github.com/openapitools/openapi-generator)
 *
 * The version of the OpenAPI document: 2.21.0-SNAPSHOT
 * 
 *
 * NOTE: This class is auto generated by OpenAPI Generator (https://openapi-generator.tech).
 * https://openapi-generator.tech
 * Do not edit the class manually.
 */


// May contain unused imports in some cases
// @ts-ignore
import { ReasonProperty } from './reason-property';

/**
 * 
 * @export
 * @interface ReasonTypeSpec
 */
export interface ReasonTypeSpec {
    /**
     * 
     * @type {string}
     * @memberof ReasonTypeSpec
     */
    'description': string;
    /**
     * 
     * @type {string}
     * @memberof ReasonTypeSpec
     */
    'displayName': string;
    /**
     * 
     * @type {Array<ReasonProperty>}
     * @memberof ReasonTypeSpec
     */
    'properties'?: Array<ReasonProperty>;
}


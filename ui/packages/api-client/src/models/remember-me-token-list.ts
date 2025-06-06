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
import { RememberMeToken } from './remember-me-token';

/**
 * 
 * @export
 * @interface RememberMeTokenList
 */
export interface RememberMeTokenList {
    /**
     * Indicates whether current page is the first page.
     * @type {boolean}
     * @memberof RememberMeTokenList
     */
    'first': boolean;
    /**
     * Indicates whether current page has previous page.
     * @type {boolean}
     * @memberof RememberMeTokenList
     */
    'hasNext': boolean;
    /**
     * Indicates whether current page has previous page.
     * @type {boolean}
     * @memberof RememberMeTokenList
     */
    'hasPrevious': boolean;
    /**
     * A chunk of items.
     * @type {Array<RememberMeToken>}
     * @memberof RememberMeTokenList
     */
    'items': Array<RememberMeToken>;
    /**
     * Indicates whether current page is the last page.
     * @type {boolean}
     * @memberof RememberMeTokenList
     */
    'last': boolean;
    /**
     * Page number, starts from 1. If not set or equal to 0, it means no pagination.
     * @type {number}
     * @memberof RememberMeTokenList
     */
    'page': number;
    /**
     * Size of each page. If not set or equal to 0, it means no pagination.
     * @type {number}
     * @memberof RememberMeTokenList
     */
    'size': number;
    /**
     * Total elements.
     * @type {number}
     * @memberof RememberMeTokenList
     */
    'total': number;
    /**
     * Indicates total pages.
     * @type {number}
     * @memberof RememberMeTokenList
     */
    'totalPages': number;
}


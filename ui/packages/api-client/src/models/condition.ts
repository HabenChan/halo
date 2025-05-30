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



/**
 * EqualsAndHashCode 排除了lastTransitionTime否则失败时，lastTransitionTime 会被更新  导致 equals 为 false，一直被加入队列.
 * @export
 * @interface Condition
 */
export interface Condition {
    /**
     * Last time the condition transitioned from one status to another.
     * @type {string}
     * @memberof Condition
     */
    'lastTransitionTime': string;
    /**
     * Human-readable message indicating details about last transition.  This may be an empty string.
     * @type {string}
     * @memberof Condition
     */
    'message'?: string;
    /**
     * Unique, one-word, CamelCase reason for the condition\'s last transition.
     * @type {string}
     * @memberof Condition
     */
    'reason'?: string;
    /**
     * Status is the status of the condition. Can be True, False, Unknown.
     * @type {string}
     * @memberof Condition
     */
    'status': ConditionStatusEnum;
    /**
     * type of condition in CamelCase or in foo.example.com/CamelCase.  example: Ready, Initialized.  maxLength: 316.
     * @type {string}
     * @memberof Condition
     */
    'type': string;
}

export const ConditionStatusEnum = {
    True: 'TRUE',
    False: 'FALSE',
    Unknown: 'UNKNOWN'
} as const;

export type ConditionStatusEnum = typeof ConditionStatusEnum[keyof typeof ConditionStatusEnum];



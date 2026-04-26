import type { ArrayElement } from "./utils.js";

export type TypeOf<T> = 
    T extends number    ? "number"    : 
    T extends string    ? "string"    :
    T extends bigint    ? "bigint"    :
    T extends boolean   ? "boolean"   :
    T extends symbol    ? "symbol"    :
    T extends undefined ? "undefined" :
    T extends Function  ? "function"  :
    T extends object    ? "object"    : never;

type ExtractType<T> = T extends unknown[] ? ArrayElement<T> : T;

type TypeTable<T> = { 
    [S in TypeOf<any>]: S extends TypeOf<ExtractType<T>> ? true : false; 
}

type GetObjectSchema<T> = TypeOf<NonNullable<ExtractType<T>>> extends "object" ? ObjectSchema<NonNullable<ExtractType<T>>> : null;

export type FieldSchema<T, K extends keyof T> = {
    array: T[K] extends unknown[] ? true : false;
    optional: T extends Record<K, T[K]> ? false : true;
    type: TypeTable<T[K]>;
    object_schema: GetObjectSchema<T[K]>;
}

export type ObjectSchema<T> = {
    [K in keyof Required<T>]: FieldSchema<T, K>;
};

class ValidatorError extends Error {
    public readonly validatorMessage: string;
    constructor(message: string, public readonly field?: string, public readonly path?: string[]) {
        const msg = 
            message + (path !== undefined  ? ` in '<root>.${path!.join(".")}'` : "");

        super(msg);
        this.validatorMessage = message;
    }
}

/**
 * @param array Array to validate
 * @param type Type table which every array element must comply with
 * @param schema Object schema to validate against if array element is an object
 */
function validate_array<T>(array: any, type: TypeTable<T>, schema: GetObjectSchema<T>) {
    if (!Array.isArray(array)) {
        throw new ValidatorError("validation error: must be an array");
    }
    for(const i in array) {
        try {
            validate_value(array[i], type, schema);
        } catch (e) {
            const f = `[${i}]`;
            if (e instanceof ValidatorError) {
                throw new ValidatorError(e.validatorMessage, e.field, [f, ...(e.path ?? [])]);
            }
            throw new ValidatorError(`unexpected error: ${e}`, f);
        }
    }
}

/**
 * @param value Value to validate
 * @param type Type table which value must comply with
 * @param schema Object schema to validate against if value is an object
 */
function validate_value<T>(value: any, type: TypeTable<T>, schema: GetObjectSchema<T>) {
    if (Array.isArray(value)) {
        throw new ValidatorError("validation error: multi-dimensional arrays are not supported.");
    }

    const valueType = typeof value;
    if (!type[valueType]) {
        const allowedTypeNames = Object.entries(type).filter(e => e[1]).map(e => e[0]);
        throw new ValidatorError(`validation error: must be ${allowedTypeNames.join(" | ")}, found ${valueType}`);
    }

    if (typeof value === "object") {
        if (!schema) {
            throw new ValidatorError("schema error: object_schema in not defined for object field");
        }
        return validate(value, schema);
    }
}

export function validate<T>(data: any, schema: ObjectSchema<T>): T {
    if (typeof data !== "object") {
        throw new ValidatorError("validation error: data is not an object");
    }
    
    for (const k in schema) {
        if (!schema[k].optional && !(k in data)) {
            throw new ValidatorError(`validation error: field '${k}' not found`, k);
        }

        try {
            if (schema[k].array) {
                validate_array(data[k], schema[k].type, schema[k].object_schema);
                continue;
            }
            validate_value(data[k], schema[k].type, schema[k].object_schema);
        } catch (e) {
            if (e instanceof ValidatorError) {
                throw new ValidatorError(e.validatorMessage, e.field, [k, ...(e.path ?? [])]);
            }
            throw new ValidatorError(`unexpected error: ${e}`, k);
        }
    }

    return data;
}
/* eslint-disable */
import type { AnyApi, FilterApi, FunctionReference } from "convex/server";
export declare const api: FilterApi<typeof fullApi, FunctionReference<any, "public">>;
export declare const internal: FilterApi<typeof fullApi, FunctionReference<any, "internal">>;
export declare const fullApi: AnyApi;

import { cacheExchange, DataField, Resolver } from "@urql/exchange-graphcache";
import Router from "next/router";
import {
  dedupExchange,
  Exchange,
  fetchExchange,
  stringifyVariables
} from "urql";
import { pipe, tap } from "wonka";
import {
  ChangePasswordMutation,
  LoginMutation,
  LogoutMutation,
  MeDocument,
  MeQuery,
  RegisterMutation
} from "../generated/graphql";
import { development_qql_uri } from "./config";
import { betterUpdateQuery } from "./utilities.better-update-query";
import { isServer } from "./utilities.is-server";

const errorExchange: Exchange = ({ forward }) => (ops$) => {
  return pipe(
    forward(ops$),
    tap(({ error }) => {
      // If the OperationResult has an error check for specific errors
      // listed below.
      // ["Not authenticated"]
      // the error is a CombinedError with networkError and graphqlErrors properties
      if (error?.message.includes("Not authenticated") && !isServer()) {
        Router.replace("/login");
      }
    })
  );
};

// import { stringifyVariables } from "@urql/core";
// import { Resolver, Variables, NullArray } from "../types";

export interface PaginationParams {
  cursorArgument?: string;
  limitArgument?: string;
}

export const cursorPagination = ({
  cursorArgument = "cursor"
}: PaginationParams = {}): Resolver => {
  return (_parent, fieldArgs, cache, info) => {
    const { parentKey: entityKey, fieldName } = info;

    const allFields = cache.inspectFields(entityKey);
    console.log("ALL FIELDS", { allFields, cursorArgument });

    const fieldInfos = allFields.filter((info) => info.fieldName === fieldName);
    const size = fieldInfos.length;

    // Cache miss. No data was found for that fieldName.
    if (size === 0) {
      return undefined;
    }

    const results: DataField = [];
    const fieldKey = `${fieldName}(${stringifyVariables(fieldArgs)})`;
    console.log("VIEW FIELD KEY", fieldKey);
    const isItInTheCache = cache.resolveFieldByKey(entityKey, fieldKey);
    console.log("IS IT IN THE CACHE", isItInTheCache);
    info.partial = !isItInTheCache;
    // Check if data is in the cache. Return the data if true.

    fieldInfos.forEach((fi) => {
      const data = cache.resolveFieldByKey(entityKey, fi.fieldKey) as string[];

      results.push(data);
    });
    console.log("VIEW CACHE RESULTS", results);
    return results;
    // const visited = new Set();
    // let result: NullArray<string> = [];
    // let prevOffset: number | null = null;

    // for (let i = 0; i < size; i++) {
    //   const { fieldKey, arguments: args } = fieldInfos[i];
    //   if (args === null || !compareArgs(fieldArgs, args)) {
    //     continue;
    //   }

    //   const links = cache.resolveFieldByKey(entityKey, fieldKey) as string[];
    //   const currentOffset = args[cursorArgument];

    //   if (
    //     links === null ||
    //     links.length === 0 ||
    //     typeof currentOffset !== "number"
    //   ) {
    //     continue;
    //   }

    //   if (!prevOffset || currentOffset > prevOffset) {
    //     for (let j = 0; j < links.length; j++) {
    //       const link = links[j];
    //       if (visited.has(link)) continue;
    //       result.push(link);
    //       visited.add(link);
    //     }
    //   } else {
    //     const tempResult: NullArray<string> = [];
    //     for (let j = 0; j < links.length; j++) {
    //       const link = links[j];
    //       if (visited.has(link)) continue;
    //       tempResult.push(link);
    //       visited.add(link);
    //     }
    //     result = [...tempResult, ...result];
    //   }

    //   prevOffset = currentOffset;
    // }

    // const hasCurrentPage = cache.resolve(entityKey, fieldName, fieldArgs);
    // if (hasCurrentPage) {
    //   return result;
    // } else if (!(info as any).store.schema) {
    //   return undefined;
    // } else {
    //   info.partial = true;
    //   return result;
    // }
  };
};

export const createUrqlClient = (ssrExchange: any, ctx: any) => {
  let cookie = "";

  // It seems that creatUrqlClient fires on
  // any page due to layout having the me query.
  // So any page without 'ssr=true' in withUrqlClient
  // won't have context??? Not sure about this yet.
  // Indicating ssr=true fixes the issue.
  // It seems context has to be created on the client
  // and then you can manually opt into ssr from there.
  if (isServer() && ctx) {
    cookie = ctx.req.headers.cookie;
    console.log("VIEW COOKIE", cookie);
  }

  return {
    fetchOptions: {
      credentials: "include" as const,
      headers: cookie
        ? {
            cookie
          }
        : undefined
    },
    url: development_qql_uri,
    exchanges: [
      dedupExchange,
      cacheExchange({
        resolvers: {
          Query: {
            getGlobalPostsSimplePagination: cursorPagination()
          }
        },
        updates: {
          Mutation: {
            changePassword: (_result, _args, cache, _info) => {
              betterUpdateQuery<ChangePasswordMutation, MeQuery>(
                cache,
                { query: MeDocument },
                _result,
                (result, query) => {
                  if (result.changePassword?.errors) {
                    return query;
                  } else {
                    return {
                      me: result.changePassword?.user,
                      __typename: "Query"
                    };
                  }
                }
              );
            },
            login: (_result, _args, cache, _info) => {
              betterUpdateQuery<LoginMutation, MeQuery>(
                cache,
                { query: MeDocument },
                _result,
                (result, query) => {
                  if (result.login?.errors) {
                    return query;
                  } else {
                    return {
                      me: result.login?.user,
                      __typename: "Query"
                    };
                  }
                }
              );
            },
            logout: (_result, _args, cache, _info) => {
              betterUpdateQuery<LogoutMutation, MeQuery>(
                cache,
                { query: MeDocument },
                _result,
                () => ({ me: null, __typename: "Query" })
              );
            },
            register: (_result, _args, cache, _info) => {
              betterUpdateQuery<RegisterMutation, MeQuery>(
                cache,
                { query: MeDocument },
                _result,
                (result, query) => {
                  if (result.register.errors) {
                    return query;
                  } else {
                    return {
                      me: result.register.user,
                      __typename: "Query"
                    };
                  }
                }
              );
            }
          }
          // Subscription: {
          //   newTodo: (result, args, cache, info) => {
          //     // ...
          //   }
          // }
        }
      }),
      errorExchange,
      ssrExchange,
      fetchExchange
    ]
  };
};

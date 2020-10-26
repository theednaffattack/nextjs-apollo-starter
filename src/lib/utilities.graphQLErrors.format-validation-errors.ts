import { OperationResult } from "urql";
import { FieldError } from "../generated/graphql";

export function formatUrqlValidationErrors<Operation>(
  response: OperationResult<Operation>
): FieldError[] {
  // // If we sense graphQL errors
  // if (
  //   response.error?.graphQLErrors &&
  //   response.error?.graphQLErrors.filter(
  //     ({ message }) => message === "Argument Validation Error"
  //   ).length > 0
  // ) {

  // First we filter for any "Argument Validation Error" messages
  // we can find. These were set by type-graphql
  const filteredValidationErrors = response.error?.graphQLErrors.filter(
    ({ message }) => message === "Argument Validation Error"
  );

  // We take the filtered validation erros and
  // copy the custom valErrors object created on our
  // server via Apollo's "formatError". These have
  // been formatted to FieldError format, so they're
  // easy to map.

  const extractedValErrors: FieldError[] = filteredValidationErrors![0]
    .extensions!.valErrors;

  return extractedValErrors;
  // }
}

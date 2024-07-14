import { parse, ParserPlugin } from "@babel/parser";
import babelTraverse from '@babel/traverse';
import * as t from '@babel/types';

interface ParsedResult {
  queryInterface: string;
  hookName: string;
  requestType: string;
  responseType: string;
  queryServiceMethodName: string;
  keyName: string;
}

// string parser to get needed info from input
export const getParamsFromRawInput = (input: object) => {
  const result: ParsedResult[] = [];

  for (const key in input) {
    const value = (input as any)[key];
    const requestType = value.requestType;
    const responseType = value.responseType;

    const capitalizedKey = key.charAt(0).toUpperCase() + key.slice(1);
    const lowerCaseKey = key.charAt(0).toLowerCase() + key.slice(1);

    const parsedObject: ParsedResult = {
      queryInterface: `Use${capitalizedKey}Query`,
      hookName: `use${capitalizedKey}`,
      requestType: `${requestType}`,
      responseType: `${responseType}`,
      queryServiceMethodName: `${lowerCaseKey}`,
      keyName: `${lowerCaseKey}Query`
    };

    result.push(parsedObject);
  }

  return result;

}

// generate Ast by using @babel/types with specified parameters
export const generateAst = (
  {
    queryInterface,
    hookName,
    requestType,
    responseType,
    queryServiceMethodName,
    keyName
  }
) => {

  const usePoolsQueryType = t.genericTypeAnnotation(
    t.identifier(queryInterface),
    t.typeParameterInstantiation([t.genericTypeAnnotation(t.identifier('TData'), null)])
  );


  const objectPattern = t.objectPattern([
    t.objectProperty(t.identifier('request'), t.identifier('request'), false, true),
    t.objectProperty(t.identifier('options'), t.identifier('options'), false, true),
  ]);

  objectPattern.typeAnnotation = t.typeAnnotation(usePoolsQueryType);

  const useQueryArrowFunction = t.arrowFunctionExpression(
    [],
    t.blockStatement([
      t.ifStatement(
        t.unaryExpression('!',
          t.identifier('queryService')
        ),
        t.throwStatement(
          t.newExpression(
            t.identifier('Error'),
            [t.stringLiteral('Query Service not initialized')]
          )
        )
      ),
      t.returnStatement(
        t.callExpression(
          t.memberExpression(
            t.identifier('queryService'),
            t.identifier(queryServiceMethodName)
          ),
          [t.identifier('request')]
        )
      )
    ])
  );

  const callExpressionTypeParameters = t.tsTypeParameterInstantiation([
    t.tSTypeReference(t.identifier(responseType)),
    t.tSTypeReference(t.identifier('Error')),
    t.tSTypeReference(t.identifier('TData')),
  ]);

  const useQueryCallExpression = t.callExpression(
    t.identifier('useQuery'),
    [
      t.arrayExpression([
        t.stringLiteral(keyName),
        t.identifier('request')
      ]),
      useQueryArrowFunction,
      t.identifier('options')
    ]
  );

  useQueryCallExpression.typeParameters = callExpressionTypeParameters;

  const arrowFunction = t.arrowFunctionExpression(
    [objectPattern],
    t.blockStatement([
      t.returnStatement(
        useQueryCallExpression
      )
    ])
  );

  // insert type arrow function
  arrowFunction.typeParameters = t.tsTypeParameterDeclaration([
    t.tsTypeParameter(
      null,
      t.tsTypeReference(t.identifier(responseType)),
      "TData"
    )
  ]);

  // to make the request optional
  const interfaceObjectProperty = t.tSPropertySignature(
    t.identifier('request'),
    t.tSTypeAnnotation(
      t.tSTypeReference(t.identifier(requestType))
    ),
    null
  )
  interfaceObjectProperty.optional = true

  return t.file(
    t.program([
      t.exportNamedDeclaration(
        t.tSInterfaceDeclaration(
          t.identifier(queryInterface),
          t.tSTypeParameterDeclaration([
            t.tSTypeParameter(
              null, null, 'TData'
            ),
          ]),
          [
            t.tSExpressionWithTypeArguments(
              t.identifier('ReactQueryParams'),
              t.tSTypeParameterInstantiation([
                t.tSTypeReference(t.identifier(responseType)),
                t.tSTypeReference(t.identifier('TData')),
              ])
            ),
          ],
          t.tSInterfaceBody([
            interfaceObjectProperty
          ])
        ),
        [],
        null
      ),
      t.variableDeclaration('const', [
        t.variableDeclarator(
          t.identifier(hookName),
          arrowFunction
        )
      ]),
    ])
  )
}

// :)
export function hackyWayToGenerateAst(
  {
    queryInterface,
    hookName,
    requestType,
    responseType,
    queryServiceMethodName,
    keyName
  }: {
    queryInterface?: string,
    hookName?: string,
    requestType?: string,
    responseType?: string,
    queryServiceMethodName?: string,
    keyName?: string
  }
) {

  const code: string = `
export interface UsePoolsQuery<TData> extends ReactQueryParams<QueryPoolsResponse, TData> {
    request?: QueryPoolsRequest;
}
const usePools = <TData = QueryPoolsResponse,>({
    request,
    options
}: UsePoolsQuery<TData>) => {
    return useQuery<QueryPoolsResponse, Error, TData>(["poolsQuery", request], () => {
        if (!queryService) throw new Error("Query Service not initialized");
        return queryService.pools(request);
    }, options);
};
    `;

  const plugins: ParserPlugin[] = [
    'typescript',
  ];

  const ast = parse(code, {
    sourceType: 'module',
    plugins
  });

  babelTraverse(ast, {
    Identifier(path) {
      if (path.node.name === 'QueryPoolsRequest') {
        path.node.name = requestType
      }
      if (path.node.name === 'QueryPoolsResponse') {
        path.node.name = responseType
      }
      if (queryInterface && path.node.name === 'UsePoolsQuery') {
        path.node.name = queryInterface
      }
      if (hookName && path.node.name === 'usePools') {
        path.node.name = hookName
      }
      if (queryServiceMethodName && path.node.name === 'pools') {
        path.node.name = queryServiceMethodName
      }
      if (keyName && path.node.name === 'poolsQuery') {
        path.node.name = keyName
      }
    }
  });

  return ast
};
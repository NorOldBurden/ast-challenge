import generate from '@babel/generator';
import { generateAst, getParamsFromRawInput } from './../src/index';
import * as inputData from '../example-methods.json'

it('tests original input', () => {
  const originalInput = {
    "Pools": {
      "requestType": "QueryPoolsRequest",
      "responseType": "QueryPoolsResponse"
    }
  };
  const paramsObj = getParamsFromRawInput(originalInput)[0]
  expect(
    generate(generateAst(paramsObj)).code
  ).toMatchSnapshot();

});

it('tests the input in example-methods file', () => {
  const paramArray = getParamsFromRawInput(inputData)
  paramArray.forEach((paramsObj) => {
    expect(
      generate(generateAst(paramsObj)).code
    ).toMatchSnapshot();
  })
})
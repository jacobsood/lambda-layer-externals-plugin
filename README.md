<div align="center">
  <h1>Webpack Lambda Layer Plugin</h1>
  <p>Efficiently Package Required Node Modules for Your Lambda Layer</p>
</div>

<p align="center">
  <a href="https://www.npmjs.com/package/webpack-lambda-layer-plugin">
    <img alt="npm version" src="https://img.shields.io/npm/v/webpack-lambda-layer-plugin.svg?style=flat-square" />
  </a>
  <a href="https://libraries.io/npm/lambda-layer-externals-plugin">
    <img alt="Dependency Status" src="https://img.shields.io/librariesio/release/npm/lambda-layer-externals-plugin?style=flat-square" />
  </a>
  <a href="https://twitter.com/acdlite/status/974390255393505280">
    <img alt="Blazing Fast" src="https://img.shields.io/badge/speed-blazing%20%F0%9F%94%A5-brightgreen.svg?style=flat-square">
  </a>
  
  <br/>

  <img alt="Main Programming Language" src="https://img.shields.io/github/languages/top/jacobsood/webpack-lambda-layer-plugin?style=flat-square" />
  <img alt="Last Commit" src="https://img.shields.io/github/last-commit/jacobsood/webpack-lambda-layer-plugin?style=flat-square" /> 
  <img alt="License" src="https://img.shields.io/npm/l/webpack-lambda-layer-plugin?style=flat-square" />
  <a href="https://github.com/prettier/prettier">
    <img alt="Code Style: Prettier" src="https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square" />
  </a>
</p>

<br />
Webpack Lambda Layer Plugin is a tool designed to simplify the process of packaging code libraries for your Lambda functions. The plugin works by bundling the necessary node dependencies as a separate package, which can then be utilized in your Lambda Layer, providing an efficient way to share code libraries with multiple Lambda Functions.

Simultaneously, these dependencies will get externalized from your Lambda Function bundles, leading to reduced bundle sizes and improved build and deployment times.

## Installation
***yarn***
```shell
yarn add --dev webpack-lambda-layer-plugin
```
***npm***
```shell
npm i --save-dev webpack-lambda-layer-plugin
```

## Usage
**webpack.config.js**
```javascript
import { LambdaLayerExternalsPlugin } from "webpack-lambda-layer-plugin";

const config: WebpackConfiguration = {
  entry: "index.js",
  output: {
    filename: "[name]/handler.js",
    path: path.resolve("dist"),
  },
  
  plugins: [
    new LambdaLayerExternalsPlugin(),
  ],
}

export default config;
```
This will generate a zip archive `dist/externals.zip` containing the used node_modules dependencies, alongside your Lambda Function bundles.

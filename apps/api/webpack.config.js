const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { join } = require('path');

module.exports = {
  output: {
    path: join(__dirname, '../../dist/apps/api'),
    ...(process.env.NODE_ENV !== 'production' && {
      devtoolModuleFilenameTemplate: '[absolute-resource-path]',
    }),
  },
  plugins: [
    new NxAppWebpackPlugin({
      target: 'node',
      compiler: 'tsc',
      /**
       * The @nestjs/swagger plugin derives the OpenAPI schema from DTO types,
       * so docs cannot drift from code and no per-field @ApiProperty is needed.
       * introspectComments uses each field's JSDoc as its description.
       */
      transformers: [
        {
          name: '@nestjs/swagger/plugin',
          options: { dtoFileNameSuffix: ['.dto.ts'], introspectComments: true },
        },
      ],
      main: './src/main.ts',
      tsConfig: './tsconfig.app.json',
      assets: ['./src/assets'],
      optimization: false,
      outputHashing: 'none',
      generatePackageJson: true,
      sourceMaps: true,
    }),
  ],
};

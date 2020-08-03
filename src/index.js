var path = (require('path'));
var types;
try {
  types = require('@pika/types');
} catch (e) {
  types = {
    MessageError: Error,
  };
}
var rollup = require('rollup');
var rollupBabel = (require('rollup-plugin-babel'));
var commonjs = (require('@rollup/plugin-commonjs'));
var { nodeResolve } = require('@rollup/plugin-node-resolve');
var fs = require('fs');
var TsconfigPaths = require('tsconfig-paths');
var { terser } = require("rollup-plugin-terser");
var workerPlugin = require('./worker-plugin');
var postcss = require('rollup-plugin-postcss');
var json = require('@rollup/plugin-json');
var replace = require('@rollup/plugin-replace')
const defaultFormat = 'esm';
const dirMap = {
  umd: 'dist-umd',
  cjs: 'dist-node',
  esm: 'dist-web',
}
const fieldMap = {
  esm: 'module',
  cjs: 'main',
  umd: 'umd:main',
};
function manifest(manifest, { options }) {
  const format = options.format || defaultFormat;
  const dist = `${dirMap[format]}/index.js`;
  const field = fieldMap[format];
  manifest[field] = manifest[field] || dist;
}

const defaultExtensions = ['.ts', '.tsx', '.jsx', '.js'];

async function build({
  out,
  cwd,
  options,
  reporter
}) {
  const format = options.format || defaultFormat;
  const dist = `${dirMap[format]}/index.js`;
  const writeToWeb = path.join(out, dist);
  const extensions = options.extensions || defaultExtensions;
  const babel = options.babel || {};
  const preserveModules = options.preserveModules || false;
  const runtimeHelpers = options.runtimeHelpers || undefined;
  const src = path.join(cwd, 'src');
  let input = path.join(src, 'index');

  const isTs = (fs.existsSync(input + '.ts') || fs.existsSync(input + '.tsx'));
  const plugins = [
    json(),
    postcss({
      extract: options.extractCSS,
      plugins: []
    }),

    workerPlugin({
      pattern: /^.+\.worker$/,
      extensions,
    }),

    nodeResolve({
      browser: true,
      extensions,
    }),

    rollupBabel({
      exclude: 'node_modules/**',
      extensions,
      runtimeHelpers,
      ...(options.envName ? { envName: options.envName } : {}),
      ...babel,
    })
  ];
  plugins.push(commonjs());

  if (options.minimize) {
    plugins.push(terser());
  }

  let matchPath;
  if (isTs) {
    const loadResult = TsconfigPaths.loadConfig(cwd);
    if (loadResult && loadResult.resultType !== 'failed') {
      matchPath = TsconfigPaths.createMatchPath(
        loadResult.absoluteBaseUrl,
        loadResult.paths,
        ['main', 'module']
      );
      plugins.push({
        name: 'rollup-plugin-ts-paths',
        resolveId(s) {
          let ret = matchPath(s, TsconfigPaths.ReadJsonSync, TsconfigPaths.FileExistsSync, extensions);
          for (e of extensions) {
            if (fs.existsSync(`${ret}${e}`)) {
              ret = `${ret}${e}`;
              break;
            }
          }
          return ret;
        }
      });
    }
  }

  let external;

  if (format === 'umd') {
    external = options.external || ['react', 'react-dom'];
    plugins.push(replace({
      "process.env.NODE_ENV": "'production'"
    }))
  }
  const result = await rollup.rollup({
    input,

    preserveModules,

    external: external || function (s) {
      const isLocal = (s.startsWith('/') || s.startsWith('./') || s.startsWith('../'));
      if (isLocal) {
        return false;
      }
      if (s === 'rollup-plugin-web-worker-loader::helper') {
        return false;
      }
      if (matchPath) {
        let ret;
        ret = matchPath(s, TsconfigPaths.ReadJsonSync, TsconfigPaths.FileExistsSync, extensions);
        if (ret) {
          return false;
        }
      }
      return true;
    },
    plugins,
    onwarn: (warning, defaultOnWarnHandler) => {
      // // Unresolved external imports are expected
      if (warning.code === 'UNRESOLVED_IMPORT' && !(warning.source.startsWith('./') || warning.source.startsWith('../'))) {
        return;
      }

      defaultOnWarnHandler(warning);
    }
  });
  let output = {
    dir: path.dirname(writeToWeb),
  };
  if (format === 'umd') {
    output = {
      ...output,
      name: options.name,
      globals: options.globals || {
        react: 'React',
        'react-dom': 'ReactDOM',
      },
    };
  }
  const config = {
    file: writeToWeb,
    format,
    ...output,
    exports: 'named',
    sourcemap: options.sourcemap === undefined ? true : options.sourcemap
  };
  if (preserveModules) {
    delete config.file;
  } else {
    delete config.dir;
  }

  await result.write(config);
  reporter.created(writeToWeb, 'module');
}


exports.build = build;
exports.manifest = manifest;

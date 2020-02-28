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
var resolve = require('@rollup/plugin-node-resolve');
var fs = require('fs');
var TsconfigPaths = require('tsconfig-paths');

const defaultFormat = 'esm';
const dirMap = {
  cjs: 'dist-node',
  esm: 'dist-web',
}
function manifest(manifest, { options }) {
  const format = options.format || defaultFormat;
  const dist = `${dirMap[format]}/index.js`;
  const field = format === 'esm' ? 'module' : 'main';
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
  const runtimeHelpers = options.runtimeHelpers || undefined;
  const src = path.join(cwd, 'src');
  let input = path.join(src, 'index');
  const isTs = (fs.existsSync(input + '.ts') || fs.existsSync(input + '.tsx'));
  const plugins = [
    resolve({
      extensions,
    }),

    rollupBabel({
      exclude: 'node_modules/**',
      extensions,
      runtimeHelpers,
      ...(options.envName ? { envName: options.envName } : {}),
    })
  ];

  let matchPath;
  if (isTs) {
    const loadResult = TsconfigPaths.loadConfig(cwd);
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
  const result = await rollup.rollup({
    input,
    external: function (s) {
      const isLocal = (s.startsWith('/') || s.startsWith('./') || s.startsWith('../'));
      if (isLocal) {
        return false;
      }
      if (isTs) {
        let ret;
        ret = matchPath(s, TsconfigPaths.ReadJsonSync, TsconfigPaths.FileExistsSync, extensions);
        if (ret) {
          return false;
        }
      }
      return true;
    },
    plugins: plugins,
    onwarn: (warning, defaultOnWarnHandler) => {
      // // Unresolved external imports are expected
      if (warning.code === 'UNRESOLVED_IMPORT' && !(warning.source.startsWith('./') || warning.source.startsWith('../'))) {
        return;
      }

      defaultOnWarnHandler(warning);
    }
  });
  await result.write({
    file: writeToWeb,
    format,
    exports: 'named',
    sourcemap: options.sourcemap === undefined ? true : options.sourcemap
  });
  reporter.created(writeToWeb, 'module');
}


exports.build = build;
exports.manifest = manifest;

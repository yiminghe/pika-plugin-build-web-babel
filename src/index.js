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

const defaultDist = 'dist-web/index.js';
const defaultFormat = 'esm';

function manifest(manifest, { options }) {
  const dist = options.dist || defaultDist;
  const format = options.format || defaultFormat;
  const field = format === 'esm' ? 'module' : 'main';
  manifest[field] = manifest[field] || dist;
}

const defaultExtensions = [ '.jsx', '.js', '.ts', '.tsx' ];

async function build({
                       out,
                       cwd,
                       options,
                       reporter
                     }) {
                      const dist = options.dist || defaultDist;
                      const format = options.format || defaultFormat;
  const writeToWeb = path.join(out, dist);
  const extensions = options.extensions || defaultExtensions;
  const runtimeHelpers = options.runtimeHelpers || undefined;
  const src = path.join(cwd, 'src');
  let input = path.join(src, 'index');

  const result = await rollup.rollup({
    input,
    external: function(s) {
     return !(s.startsWith('/') || s.startsWith('./') || s.startsWith('../'));
    },
    plugins: [
      resolve({
        extensions,
      }),
      rollupBabel({
        exclude: 'node_modules/**',
        extensions,
        runtimeHelpers,
        ...(options.envName?{envName:options.envName}:{}),
      }) ],
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

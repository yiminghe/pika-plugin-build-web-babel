var path = (require('path'));
var fs = (require('fs'));
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

async function beforeJob({
                           out
                         }) {
  const srcDirectory = path.join(out, 'dist-src/');

  if (!fs.existsSync(srcDirectory)) {
    throw new types.MessageError('"dist-src/" does not exist, or was not yet created in the pipeline.');
  }

  const srcEntrypoint = path.join(out, 'dist-src/index.js');

  if (!fs.existsSync(srcEntrypoint)) {
    throw new types.MessageError('"dist-src/index.js" is the expected standard entrypoint, but it does not exist.');
  }
}

function manifest(manifest) {
  manifest.module = manifest.module || 'dist-web/index.js';
}

const defaultExtensions = [ '.jsx', '.js', '.ts', '.tsx' ];

async function build({
                       out,
                       cwd,
                       options,
                       reporter
                     }) {
  const writeToWeb = path.join(out, 'dist-web', 'index.js');
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
        runtimeHelpers
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
    format: 'esm',
    exports: 'named',
    sourcemap: options.sourcemap === undefined ? true : options.sourcemap
  });
  reporter.created(writeToWeb, 'module');
}

exports.beforeJob = beforeJob;
exports.build = build;
exports.manifest = manifest;

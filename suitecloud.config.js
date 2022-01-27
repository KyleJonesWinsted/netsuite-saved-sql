const hooks = require('suitecloud-config-hooks');

module.exports = {
  commands: {
    'object:import': {
      onCompleted: hooks.organizeImportedObjects,
    }
  }
}

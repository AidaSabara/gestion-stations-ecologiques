'use strict';

const { Plugin } = require('kuzzle-plugin');

class WaterAlertsPlugin extends Plugin {
  constructor() {
    super();
  }

  init() {
    // Événement déclenché après chaque création ou mise à jour d'un document
    this.kuzzle.on('document:afterWrite', async (request) => {
      const { _id, _source, collection, index } = request.result;

      // Ne traiter que la collection water_quality
      if (index !== 'iot' || collection !== 'water_quality') {
        return;
      }

      const thresholds = this.config.thresholds || {};
      const alerts = [];

      // Vérifie chaque paramètre
      for (const [param, rule] of Object.entries(thresholds)) {
        if ((rule.min !== undefined && _source[param] < rule.min) ||
            (rule.max !== undefined && _source[param] > rule.max)) {
          
          alerts.push({
            stationId: _source.stationId,
            parameter: param,
            value: _source[param],
            message: `Alerte ${param} = ${_source[param]} pour la station ${_source.stationId}`,
            status: 'new',
            timestamp: new Date().toISOString()
          });
        }
      }

      // Pour chaque alerte, on vérifie si elle existe déjà pour éviter les doublons
      for (const alert of alerts) {
        const existing = await this.kuzzle.document.search('iot', 'alerts', {
          query: {
            bool: {
              must: [
                { match: { stationId: alert.stationId } },
                { match: { parameter: alert.parameter } },
                { match: { status: 'new' } }
              ]
            }
          }
        });

        if (existing.hits.length === 0) {
          await this.kuzzle.document.create('iot', 'alerts', alert);
        }
      }
    });
  }
}

module.exports = WaterAlertsPlugin;
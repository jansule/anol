import FeatureLayer from './feature';
import GeoJSON from 'ol/format/GeoJSON';
import { all, bbox } from 'ol/loadingstrategy';

import SensorThingsClient from '../sensorthings/sensorthingsClient';

class SensorThings extends FeatureLayer {
    constructor(_options) {
        super(_options);
        this.CLASS_NAME = 'anol.layer.SensorThings';
        const DEFAULT_OPTS = {
            urlParameters: {
                filter: undefined,
                expand: undefined
            },
            loadInCurrentExtent: false,
            refreshInterval: 5
        };
        this.urlParameters = $.extend(true, {}, DEFAULT_OPTS.urlParameters, _options.olLayer.source.urlParameters);
        this.loadInCurrentExtent = _options.olLayer.source.loadInCurrentExtent ?? false;
        this.url = _options.olLayer.source.url;
        this.refreshInterval = (_options.olLayer.source.refreshInterval ?? DEFAULT_OPTS.refreshInterval) * 1000;
        delete _options.olLayer.source;

        this.olLayerOptions = _options.olLayer;
        this.olLayer = undefined;
        this.saveable = false;
        this.editable = false;
        this.subscription = undefined;
        this.isWatching = false;
        this.mapProjection = undefined;
    }

    createLoader() {
        var sensorThingsInst = this;
        return function (extent, resolution, projection, success, failure) {
            sensorThingsInst.mapProjection = projection;
            sensorThingsInst.loadData()
                .then(features => {
                    success(features);
                });
        };
    }

    subscribe() {
        const sensorThingsInst = this;
        this.subscription = setTimeout(() => {
            // We cannot use vectorSource.refresh() here,
            // since there old features will be removed before
            // requesting new data. Our approach clears old
            // features after new data is loaded, which should address
            // for a smoother feeling.
            sensorThingsInst.loadData();
        }, this.refreshInterval);
    }

    unsubscribe() {
        if (this.subscription) {
            clearTimeout(this.subscription);
        }
    }

    watchVisibility() {
        if (this.isWatching) {
            return;
        }

        this.isWatching = true;
        const sensorThingsInst = this;

        this.olLayer.on('change:visible', function () {
            if (!sensorThingsInst.olLayer.getVisible()) {
                sensorThingsInst.unsubscribe();
            } else {
                sensorThingsInst.subscribe();
            }
        });
    }

    async loadData() {
        const client = new SensorThingsClient({
            url: this.url,
            urlParameters: this.urlParameters,
            loadInCurrentExtent: this.loadInCurrentExtent
        });

        const vectorSource = this.olLayer.getSource();

        const data = await client.get();
        const featureCollection = client.datastreamToGeoJSON(data);
        const features = vectorSource.getFormat()
            .readFeatures(featureCollection, {
                featureProjection: this.mapProjection
            });
        vectorSource.clear(true);
        vectorSource.addFeatures(features);
        this.watchVisibility();
        this.subscribe();
        return features;
    }

    _createSourceOptions(srcOptions) {
        srcOptions.strategy = this.loadInCurrentExtent ? bbox : all;
        srcOptions.loader = this.createLoader();
        srcOptions.format = new GeoJSON();
        return super._createSourceOptions(srcOptions);
    }
}

export default SensorThings;

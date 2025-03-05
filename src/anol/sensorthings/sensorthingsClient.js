class SensorThingsClient {
    constructor(opts) {
        this.url = opts.url;
        this.urlParameters = opts.urlParameters;
        this.version = '1.1';
    }

    createUrl() {
        const root = 'Datastreams';
        const isFullUrl = /^https?:\/\//.test(this.url);
        let url;
        if (isFullUrl) {
            url = new URL(this.url);
        } else {
            url = new URL(this.url, 'file://');
        }
        if (url.pathname.endsWith('/')) {
            url.pathname = url.pathname.slice(0, -1);
        }

        if (!url.pathname.endsWith(`/v${this.version}/${root}`)) {
            url.pathname += `/v${this.version}/${root}`;
        }

        if (this.urlParameters.filter) {
            url.searchParams.set('$filter', this.urlParameters.filter);
        }
        if (this.urlParameters.expand) {
            // If users provide custom expand, they have to ensure
            // that the location is included
            url.searchParams.set('$expand', this.urlParameters.expand);
        } else {
            // Ensuring we will always get the location
            url.searchParams.set('$expand', 'Thing/Location');
        }

        return isFullUrl ? url.toString() : url.toString().replace('file://', '');
    }

    async get() {
        const url = this.createUrl();
        let data = await this.sendRequest(url);
        if (data['@iot.nextLink']) {
            data = await this.resolveNextLink(data['@iot.nextLink'], data);
        }
        return data;
    }

    async sendRequest(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Could  not fetch SensorThingsAPI data. Status: ${response.status}`);
        }
        return response.json();
    }

    async resolveNextLink(nextLink, data) {
        const response = await this.sendRequest(nextLink);
        const resolvedData = {
            ...data,
            value: [
                ...data.value,
                ...response.value
            ]
        };
        if (response['@iot.nextLink']) {
            return this.resolveNextLink(response['@iot.nextLink'], resolvedData);
        }
        return resolvedData;
    }

    datastreamToGeoJSON(datastream) {
        const observations = datastream.value;

        const features = observations.map(observation => {
            const thing = observation.Thing;
            const feature = {
                type: 'Feature',
                properties: {
                    ...observation
                },
                geometry: thing.Locations[0].location,
            };
            return feature;
        });

        return {
            type: 'FeatureCollection',
            features
        };
    }
}

export default SensorThingsClient;

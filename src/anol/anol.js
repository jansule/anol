/**
 * @ngdoc overview
 * @name anol
 * @description
 * Wrapper namespace
 */

import proj4 from 'proj4';
import {register} from 'ol/proj/proj4.js';

proj4.defs('EPSG:25832', '+proj=utm +zone=32 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs');
register(proj4);

import helper from './helper.js';
import Nominatim from './geocoder/nominatim.js';
import Solr from './geocoder/solr.js';
import Catalog from './geocoder/catalog.js';

import AnolBaseLayer from './layer.js';
import BaseWMS from './layer/basewms.js';
import SingleTileWMS from './layer/singletilewms.js';
import TiledWMS from './layer/tiledwms.js';
import TMS from './layer/tms.js';
import WMTS from './layer/wmts.js';
import FeatureLayer from './layer/feature.js';
import Group from './layer/group.js';

import StaticGeoJSON from './layer/staticgeojson.js';
import DynamicGeoJSON from './layer/dynamicgeojson.js';
import BBOXGeoJSON from './layer/bboxgeojson.js';
import GMLLayer from './layer/gml.js';
import SensorThings from './layer/sensorthings.js';

import ContextMenu from './contextmenu/ContextMenu.js';
import Control from './control.js';

export var geocoder = {
    Nominatim: Nominatim,
    Solr: Solr,
    Catalog: Catalog,
};
export var layer = {
    BaseWMS: BaseWMS,
    SingleTileWMS: SingleTileWMS,
    TiledWMS: TiledWMS,
    TMS: TMS,
    WMTS: WMTS,
    Group: Group,
    Feature: FeatureLayer,
    StaticGeoJSON: StaticGeoJSON,
    DynamicGeoJSON: DynamicGeoJSON,
    BBOXGeoJSON: BBOXGeoJSON,
    GML: GMLLayer,
    Layer: AnolBaseLayer,
    SensorThings
};

export var control = {
    Control: Control,
    ContextMenu: ContextMenu
};
window.anol = {
    'layer': layer,
    'control': control,
    'helper': helper,
    'geocoder': geocoder
};

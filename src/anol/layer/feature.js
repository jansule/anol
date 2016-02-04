/**
 * @ngdoc object
 * @name anol.layer.Feature
 *
 * @param {Object} options AnOl Layer options
 * @param {Object} options.olLayer Options for ol.layer.Vector
 * @param {Object} options.olLayer.source Options for ol.source.Vector
 *
 * @description
 * Inherits from {@link anol.layer.Layer anol.layer.Layer}.
 */
 anol.layer.Feature = function(_options) {
    if(_options === false) {
        anol.layer.Layer.call(this, _options);
        return;
    }
    var self = this;
    var defaults = {};
    var options = $.extend({},
        anol.layer.Layer.prototype.DEFAULT_OPTIONS,
        defaults,
        _options
    );
    var hasStyleFunction = angular.isFunction(options.olLayer.style);

    this.sourceOptions = this._createSourceOptions(options.olLayer.source);
    options.olLayer.source = new ol.source.Vector(this.sourceOptions);

    options.olLayer = new ol.layer.Vector(options.olLayer);

    anol.layer.Layer.call(this, options);

    // if the layer has an own style function we don't create an style object
    if (!hasStyleFunction) {

        var defaultStyle = angular.isFunction(this.olLayer.getStyle()) ?
            this.olLayer.getStyle()()[0] : this.olLayer.getStyle();

        if(options.style !== undefined) {
            var createImageStyleFunction = options.style.externalGraphic !== undefined ?
                this.createIconStyle : this.createCircleStyle;

            this.defaultStyle = new ol.style.Style({
                image: createImageStyleFunction.call(this, options.style, defaultStyle.getImage()),
                fill: this.createFillStyle(options.style, defaultStyle.getFill()),
                stroke: this.createStrokeStyle(options.style, defaultStyle.getStroke()),
                text: this.createTextStyle(options.style, defaultStyle.getText())
            });
        } else {
            this.defaultStyle = defaultStyle;
        }

        this.olLayer.setStyle(function(feature) {
            return [self.createStyle(feature)];
        });
    }

    this.isVector = true;
    this.loaded = true;
    this.saveable = options.saveable || false;
    this.editable = options.editable || false;
};
anol.layer.Feature.prototype = new anol.layer.Layer(false);
$.extend(anol.layer.Feature.prototype, {
    CLASS_NAME: 'anol.layer.Feature',
    DEFAULT_FONT_FACE: 'Helvetica',
    DEFAULT_FONT_SIZE: '10px',
    DEFAULT_FONT_WEIGHT: 'normal',
    extent: function() {
        var extent = this.olLayer.getSource().getExtent();
        if(ol.extent.isEmpty(extent)) {
            return false;
        }
        return extent;
    },
    createStyle: function(feature, resolution) {
        var defaultStyle = angular.isFunction(this.defaultStyle) ?
            this.defaultStyle(feature, resolution)[0] : this.defaultStyle;
        var hasTextStyle = defaultStyle.getText() !== null;
        if(feature === undefined) {
            return defaultStyle;
        }

        var geometryType = feature.getGeometry().getType();
        var featureStyle = feature.get('style') || {};
        if(angular.equals(featureStyle, {}) && !hasTextStyle) {
            return defaultStyle;
        }
        var styleOptions = {};
        if(geometryType === 'Point') {
            styleOptions.image = this.createImageStyle(featureStyle, defaultStyle.getImage());
        } else {
            // line features ignores fill style
            styleOptions.fill = this.createFillStyle(featureStyle, defaultStyle.getFill());
            styleOptions.stroke = this.createStrokeStyle(featureStyle, defaultStyle.getStroke());
        }
        styleOptions.text = this.createTextStyle(featureStyle, defaultStyle.getText(), feature);
        return new ol.style.Style(styleOptions);
    },
    createImageStyle: function(style, defaultImageStyle) {
        var radius = style.radius;
        var externalGraphic = style.externalGraphic;

        var isCircle = radius !== undefined;
        var isIcon = externalGraphic !== undefined;
        var isDefaultCircle = defaultImageStyle instanceof ol.style.Circle;
        var isDefaultIcon = defaultImageStyle instanceof ol.style.Icon;


        if(isCircle || (!isIcon && isDefaultCircle)) {
            return this.createCircleStyle(style, defaultImageStyle);
        } else if (isIcon || (!isCircle && isDefaultIcon)) {
            return this.createIconStyle(style, defaultImageStyle);
        }
        return defaultImageStyle;
    },
    createCircleStyle: function(style, defaultCircleStyle) {
        var defaultStrokeStyle = new ol.style.Stroke();
        var defaultFillStyle = new ol.style.Fill();
        var radius;
        if(defaultCircleStyle instanceof ol.style.Circle) {
            defaultStrokeStyle = defaultCircleStyle.getStroke();
            defaultFillStyle = defaultCircleStyle.getFill();
            radius = defaultCircleStyle.getRadius();
        }

        var _radius = style.radius;
        if(_radius !== undefined) {
            radius = parseFloat(_radius);
        }
        return new ol.style.Circle({
            radius: radius,
            stroke: this.createStrokeStyle(style, defaultStrokeStyle),
            fill: this.createFillStyle(style, defaultFillStyle)
        });
    },
    createIconStyle: function(style, defaultIconStyle) {
        var src;
        var rotation;
        var scale;
        var size;
        if(defaultIconStyle instanceof ol.style.Icon) {
            src = defaultIconStyle.getSrc();
            rotation = defaultIconStyle.getRotation();
            scale = defaultIconStyle.getScale();
            size = defaultIconStyle.getSize();
        }
        var externalGraphic = style.externalGraphic;
        if(externalGraphic !== undefined) {
            src = externalGraphic;
        }
        var _rotation = style.rotation;
        if(_rotation !== undefined) {
            rotation = parseFloat(_rotation);
        }

        var graphicWidth = style.graphicWidth;
        var graphicHeight = style.graphicHeight;
        if(graphicWidth !== undefined && graphicHeight !== undefined) {
            size = [
                parseInt(graphicWidth),
                parseInt(graphicHeight)
            ];
        }

        var iconStyleConf = {
            src: src,
            rotation: rotation,
            size: size
        };

        var iconStyle = new ol.style.Icon(iconStyleConf);

        var _scale = style.scale;
        if(_scale !== undefined) {
            scale = parseFloat(_scale);
        }
        if(scale === undefined && graphicWidth !== undefined) {
            if (size !== null) {
                scale = parseInt(graphicWidth) / size[0];
            }
        }
        if(scale !== undefined && scale !== 1) {
            iconStyle.setScale(scale);
        }
        return iconStyle;
    },
    createFillStyle: function(style, defaultFillStyle) {
        var color = ol.color.asArray(defaultFillStyle.getColor()).slice();
        var fillColor = style.fillColor;
        if (fillColor !== undefined) {
            fillColor = ol.color.asArray(fillColor);
            color[0] = fillColor[0];
            color[1] = fillColor[1];
            color[2] = fillColor[2];
        }
        var fillOpacity = style.fillOpacity;
        if(fillOpacity !== undefined) {
            color[3] = parseFloat(fillOpacity);
        }
        return new ol.style.Fill({
            color: color
        });
    },
    createStrokeStyle: function(style, defaultStrokeStyle) {
        var color = ol.color.asArray(defaultStrokeStyle.getColor()).slice();
        var strokeWidth = defaultStrokeStyle.getWidth();
        var strokeDashstyle = defaultStrokeStyle.getLineDash();

        var strokeColor = style.strokeColor;
        if(strokeColor !== undefined) {
            strokeColor = ol.color.asArray(strokeColor);
            color[0] = strokeColor[0];
            color[1] = strokeColor[1];
            color[2] = strokeColor[2];
        }
        var strokeOpacity = style.strokeOpacity;
        if(strokeOpacity !== undefined) {
            color[3] = parseFloat(strokeOpacity);
        }
        var _strokeWidth = style.strokeWidth;
        if(_strokeWidth !== undefined) {
            strokeWidth = parseFloat(_strokeWidth);
        }
        var _strokeDashstyle = style.strokeDashstyle;
        if(_strokeDashstyle !== undefined) {
            strokeDashstyle = this.createDashStyle(strokeWidth, _strokeDashstyle);
        }

        return new ol.style.Stroke({
            color: color,
            width: strokeWidth,
            lineDash: strokeDashstyle,
            lineJoin: 'round'
        });
    },
    // Taken from OpenLayers 2.13.1
    // see https://github.com/openlayers/openlayers/blob/release-2.13.1/lib/OpenLayers/Renderer/SVG.js#L391
    createDashStyle: function(strokeWidth, strokeDashstyle) {
        var w = strokeWidth;
        var str = strokeDashstyle;
        switch (str) {
            case 'dot':
                return [1, 4 * w];
            case 'dash':
                return [4 * w, 4 * w];
            case 'dashdot':
                return [4 * w, 4 * w, 1, 4 * w];
            case 'longdash':
                return [8 * w, 4 * w];
            case 'longdashdot':
                return [8 * w, 4 * w, 1, 4 * w];
            // also matches 'solid'
            default:
                return undefined;
          }
    },
    getLabel: function(feature, labelKey) {
        if(feature === undefined) {
            return '';
        }
        return feature.get(labelKey);
    },
    createTextStyle: function(style, defaultTextStyle, feature) {
        var fontWeight = this.DEFAULT_FONT_WEIGHT;
        var fontFace = this.DEFAULT_FONT_FACE;
        var fontSize = this.DEFAULT_FONT_SIZE;
        var defaultTextFillStyle;

        // atm defaultTextStyle is null
        if(defaultTextStyle !== null) {
            var splittedFont = defaultTextStyle.getFont().split(' ');
            fontWeight = splittedFont[0];
            fontSize = splittedFont[1];
            fontFace = splittedFont[2];
            defaultTextFillStyle = defaultTextStyle.getFill();
        }
        var styleOptions = {};
        if(style.label !== undefined) {
            styleOptions.text = this.getLabel(feature, style.label);
        }
        if(style.fontWeight !== undefined) {
            fontWeight = style.fontWeight;
        }
        if(style.fontSize !== undefined) {
            fontSize = style.fontSize;
        }
        if(style.fontFace !== undefined) {
            fontFace = style.fontFace;
        }
        styleOptions.font = [fontWeight, fontSize, fontFace].join(' ');

        var fontColor;
        if(defaultTextFillStyle !== undefined && defaultTextFillStyle !== null) {
            fontColor = defaultTextFillStyle.getColor();
            if(fontColor !== undefined) {
                fontColor = ol.color.asArray(fontColor).slice();
            }
        }
        if(style.fontColor !== undefined) {
            var _fontColor = ol.color.asArray(style.fontColor);
            if(_fontColor !== undefined) {
                fontColor[0] = _fontColor[0];
                fontColor[1] = _fontColor[1];
                fontColor[2] = _fontColor[2];
            }
        }

        if(fontColor !== undefined) {
            styleOptions.fill = new ol.style.Fill({
                color: fontColor
            });
        }

        if(Object.keys(style).length > 0) {
            return new ol.style.Text(styleOptions);
        }
        return undefined;
    }
    // TODO add getProperties method including handling of hidden properties like style
    // TODO add hasProperty method
});

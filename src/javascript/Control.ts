import L from 'leaflet'
import Util from './Util'
import ControlOptions from './ControlOptions'

class StyleEditorControl extends L.Control {
  private util = Util.getInstance()

    options: ControlOptions = {
      position: 'topleft',

      colorRamp: ['#1abc9c', '#2ecc71', '#3498db', '#9b59b6', '#34495e', '#16a085', '#27ae60', '#2980b9', '#8e44ad',
        '#2c3e50', '#f1c40f', '#e67e22', '#e74c3c', '#ecf0f1', '#95a5a6', '#f39c12', '#d35400', '#c0392b',
        '#bdc3c7', '#7f8c8d'],
      defaultColor: null,

      markers: null,
      defaultMarkerIcon: null,
      defaultMarkerColor: null,

      ignoreLayerTypes: [],

      forms: {},

      openOnLeafletDraw: true,
      openOnLeafletEditable: true,

      showTooltip: true,

      strings: {
        cancel: 'Cancel',
        cancelTitle: 'Cancel Styling',
        tooltip: 'Click on the element you want to style',
        tooltipNext: 'Choose another element you want to style'
      },
      useGrouping: true,

      styleEditorEventPrefix: 'styleeditor:',

      // internal
      currentElement: null,
      _editLayers: [],
      _layerGroups: []

    }

    initialize(options) {
      if (options) {
        this.setOptions(this, options)
      }

      this.options.markerType = new this.options.markerType({styleEditorOptions: this.options})
      this.options.markerForm = new this.options.markerType.markerForm({styleEditorOptions: this.options})
      this.options.geometryForm = new this.options.geometryForm({styleEditorOptions: this.options})

      this.getDefaultIcon = this.options.markerType._createMarkerIcon.bind(this.options.markerType)
      this.createIcon = this.options.markerType.createMarkerIcon.bind(this.options.markerType)
    }

    onAdd(map: L.Map) {
      this.options.map = map
      return this.createUi()
    }

    fireEvent(eventName, element) {
      this.util.fireEvent(eventName, element)
    }

    createUi() {
      let controlDiv = this.options.controlDiv = L.DomUtil.create('div', 'leaflet-control-styleeditor leaflet-control leaflet-bar')
      let controlUI = this.options.controlUI = L.DomUtil.create('a', 'leaflet-control-styleeditor-interior',
        controlDiv)
      controlUI.title = 'Style Editor'

      let cancel = this.options.cancelUI = L.DomUtil.create('div', 'leaflet-control-styleeditor-cancel leaflet-styleeditor-hidden', controlDiv)
      cancel.innerHTML = this.options.strings.cancel
      cancel.title = this.options.strings.cancelTitle

      let styleEditorDiv = this.options.styleEditorDiv =
        L.DomUtil.create('div', 'leaflet-styleeditor', this.options.map._container)
      this.options.styleEditorHeader = L.DomUtil.create('div', 'leaflet-styleeditor-header', styleEditorDiv)
      let styleEditorInterior = L.DomUtil.create('div', 'leaflet-styleeditor-interior', styleEditorDiv)

      this.addDomEvents()
      this.addEventListeners()
      this.addButtons()

      this.options.styleForm = new L.StyleForm({
        styleEditorDiv: styleEditorDiv,
        styleEditorInterior: styleEditorInterior,
        styleEditorOptions: this.options
      })

      return controlDiv
    }

    addDomEvents() {
      L.DomEvent.disableScrollPropagation(this.options.styleEditorDiv)
      L.DomEvent.disableScrollPropagation(this.options.controlDiv)
      L.DomEvent.disableScrollPropagation(this.options.cancelUI)

      L.DomEvent.disableClickPropagation(this.options.styleEditorDiv)
      L.DomEvent.disableClickPropagation(this.options.controlDiv)
      L.DomEvent.disableClickPropagation(this.options.cancelUI)

      L.DomEvent.on(this.options.controlDiv, 'click', function () {
        this.toggle()
      }, this)
    }

    addEventListenersfunction () {
      this.addLeafletDrawEvents()
      this.addLeafletEditableEvents()
    }

    addLeafletDrawEvents() {
      if (!this.options.openOnLeafletDraw || !L.Control.Draw) {
        return
      }
      this.options.map.on('layeradd', this.onLayerAdd, this)
      this.options.map.on(L.Draw.Event.CREATED, this.onLayerCreated, this)
    }

    addLeafletEditableEvents() {
      if (!this.options.openOnLeafletEditable || !L.Editable) {
        return
      }
      this.options.map.on('layeradd', this.onLayerAdd, this)
      this.options.map.on('editable:created', this.onLayerCreated, this)
    }

    onLayerCreated(layer) {
      this.removeIndicators()
      this.options.currentElement = layer.layer
    }

    onLayerAdd(e) {
      if (this.options.currentElement) {
        if (e.layer === this.options.util.getCurrentElement()) {
          this.enable(e.layer)
        }
      }
    }

    onRemove() {
      // hide everything that may be visible
      // remove edit events for layers
      // remove tooltip
      this.disable()

      // remove events
      this.removeDomEvents()
      this.removeEventListeners()

      // remove dom elements
      L.DomUtil.remove(this.options.styleEditorDiv)
      L.DomUtil.remove(this.options.cancelUI)

      // delete dom elements
      delete this.options.styleEditorDiv
      delete this.options.cancelUI
    }

    removeEventListeners() {
      this.options.map.off('layeradd', this.onLayerAdd)
      if (L.Draw) {
        this.options.map.off(L.Draw.Event.CREATED, this.onLayerCreated)
      }
      if (L.Editable) {
        this.options.map.off('editable:created', this.onLayerCreated)
      }
    }

    removeDomEvents() {
      L.DomEvent.off(this.options.controlDiv, 'click', function () {
        this.toggle()
      }, this)
    }

    addButtons() {
      let nextBtn = L.DomUtil.create('button',
        'leaflet-styleeditor-button styleeditor-nextBtn', this.options.styleEditorHeader)
      nextBtn.title = this.options.strings.tooltipNext

      L.DomEvent.on(nextBtn, 'click', function (e) {
        this.hideEditor()

        if (L.DomUtil.hasClass(this.options.controlUI, 'enabled')) {
          this.createTooltip()
        }

        e.stopPropagation()
      }, this)
    }

    toggle() {
      if (L.DomUtil.hasClass(this.options.controlUI, 'enabled')) {
        this.disable()
      } else {
        this.enable()
      }
    }

    enable(layer) {
      if (this._layerIsIgnored(layer)) {
        return
      }

      L.DomUtil.addClass(this.options.controlUI, 'enabled')
      this.options.map.eachLayer(this.addEditClickEvents, this)
      this.showCancelButton()
      this.createTooltip()

      if (layer !== undefined) {
        if (this.isEnabled()) {
          this.removeIndicators()
        }
        this.initChangeStyle({target: layer})
      }
    }

    isEnabled() {
      return L.DomUtil.hasClass(this.options.controlUI, 'enabled')
    }

    disable() {
      if (this.isEnabled()) {
        this.options._editLayers.forEach(this.removeEditClickEvents, this)
        this.options._editLayers = []
        this.options._layerGroups = []
        this.hideEditor()
        this.hideCancelButton()
        this.removeTooltip()
        L.DomUtil.removeClass(this.options.controlUI, 'enabled')
      }
    }

    addEditClickEvents(layer) {
      if (this._layerIsIgnored(layer)) {
        return
      }
      if (this.options.useGrouping && layer instanceof L.LayerGroup) {
        this.options._layerGroups.push(layer)
      } else if (layer instanceof L.Marker || layer instanceof L.Path) {
        let evt = layer.on('click', this.initChangeStyle, this)
        this.options._editLayers.push(evt)
      }
    }

    removeEditClickEvents(layer) {
      layer.off('click', this.initChangeStyle, this)
    }

    addIndicators() {
      if (!this.options.currentElement) {
        return
      }

      let currentElement = this.options.currentElement.target
      if (currentElement instanceof L.LayerGroup) {
        currentElement.eachLayer(function (layer) {
          if (layer instanceof L.Marker && layer.getElement()) {
            L.DomUtil.addClass(layer.getElement(), 'leaflet-styleeditor-marker-selected')
          }
        })
      } else if (currentElement instanceof L.Marker) {
        if (currentElement.getElement()) {
          L.DomUtil.addClass(currentElement.getElement(), 'leaflet-styleeditor-marker-selected')
        }
      }
    }

    removeIndicators() {
      if (!this.options.currentElement) {
        return
      }

      let currentElement = this.options.util.getCurrentElement()
      if (currentElement instanceof L.LayerGroup) {
        currentElement.eachLayer(function (layer) {
          if (layer.getElement()) {
            L.DomUtil.removeClass(layer.getElement(), 'leaflet-styleeditor-marker-selected')
          }
        })
      } else {
        if (currentElement.getElement()) {
          L.DomUtil.removeClass(currentElement.getElement(), 'leaflet-styleeditor-marker-selected')
        }
      }
    }

    hideEditor() {
      if (L.DomUtil.hasClass(this.options.styleEditorDiv, 'editor-enabled')) {
        this.removeIndicators()
        L.DomUtil.removeClass(this.options.styleEditorDiv, 'editor-enabled')
        this.fireEvent('hidden')
      }
    },

    hideCancelButton() {
      L.DomUtil.addClass(this.options.cancelUI, 'leaflet-styleeditor-hidden')
    }

    showEditor() {
      let editorDiv = this.options.styleEditorDiv
      if (!L.DomUtil.hasClass(editorDiv, 'editor-enabled')) {
        L.DomUtil.addClass(editorDiv, 'editor-enabled')
        this.fireEvent('visible')
      }
    }

    showCancelButton() {
      L.DomUtil.removeClass(this.options.cancelUI, 'leaflet-styleeditor-hidden')
    }

    initChangeStyle(e) {
      this.removeIndicators()
      this.options.currentElement = (this.options.useGrouping) ? this.getMatchingElement(e) : e

      this.addIndicators()
      this.showEditor()
      this.removeTooltip()

      let layer = e
      if (!(layer instanceof L.Layer)) {
        layer = e.target
      }

      this.fireEvent('editing', layer)
      if (layer instanceof L.Marker) {
        // ensure iconOptions are set for Leaflet.Draw created Markers
        this.options.markerType.resetIconOptions()
        // marker
        this.showMarkerForm(layer)
      } else {
        // layer with of type L.GeoJSON or L.Path (polyline, polygon, ...)
        this.showGeometryForm(layer)
      }
    }

    showGeometryForm(layer) {
      this.fireEvent('geometry', layer)
      this.options.styleForm.showGeometryForm()
    }

    showMarkerForm(layer) {
      this.fireEvent('marker', layer)
      this.options.styleForm.showMarkerForm()
    }

    createTooltip() {
      if (!this.options.showTooltip) {
        return
      }

      if (!this.options.tooltipWrapper) {
        this.options.tooltipWrapper =
          L.DomUtil.create('div', 'leaflet-styleeditor-tooltip-wrapper', this.options.map.getContainer())
      }

      if (!this.options.tooltip) {
        this.options.tooltip = L.DomUtil.create('div', 'leaflet-styleeditor-tooltip', this.options.tooltipWrapper)
      }
      this.options.tooltip.innerHTML = this.options.strings.tooltip
    }

    getMatchingElement(e) {
      let group = null
      let layer = e.target

      for (let i = 0; i < this.options._layerGroups.length; ++i) {
        group = this.options._layerGroups[i]
        if (group && layer !== group && group.hasLayer(layer)) {
          // we use the opacity style to check for correct object
          if (!group.options || !group.options.opacity) {
            group.options = layer.options

            // special handling for layers... we pass the setIcon function
            if (layer.setIcon) {
              group.setIcon = function (icon) {
                group.eachLayer(function (layer) {
                  if (layer instanceof L.Marker) {
                    layer.setIcon(icon)
                  }
                })
              }
            }
          }

          return this.getMatchingElement({
            target: group
          })
        }
      }
      return e
    }

    removeTooltip() {
      if (this.options.tooltip && this.options.tooltip.parentNode) {
        this.options.tooltip.remove()
        this.options.tooltip = undefined
      }
    }

    _layerIsIgnored(layer) {
      if (layer === undefined) {
        return false
      }
      return this.options.ignoreLayerTypes.some(
        layerType => layer.styleEditor && layer.styleEditor.type.toUpperCase() === layerType.toUpperCase()
      )
    }
  }

  L.control.styleEditor = function(options) {
    if (!options) {
      options = {}
    }
    return new L.Control.StyleEditor(options)
  }

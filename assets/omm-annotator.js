(function() {
    // ==========================================
    // CUSTOMIZABLE HOTKEYS
    // Edit these letters to change your hotkeys!
    // ==========================================
    var HOTKEYS = {
        UNDO: 'z',          // Press Ctrl + Z to undo
        LINE: 'l',          // Press L for Polyline tool
        CIRCLE: 'c',        // Press C for Circle tool
        MARKER: 'm',        // Press M for Marker tool
        POLYGON: 'p',       // Press P for Polygon (Filled shape) tool
        RECTANGLE: 'r',     // Press R for Rectangle tool
        PAINT_MODE: 'b'     // Press B to toggle Paint Bucket mode
    };
    // ==========================================

    var checkMap = setInterval(function() {
        if (typeof map !== 'undefined' && map instanceof L.Map) {
            clearInterval(checkMap);
            initAnnotator(map);
        }
    }, 100);

    function initAnnotator(map) {
        console.log("Initializing OMM Annotator with Palette...");
        map.off('click'); // Remove default coordinate popup

        var drawnItems = new L.FeatureGroup();
        map.addLayer(drawnItems);

        var currentColor = '#ff0000';
        var colorPalette = ['#ff0000', '#3388ff', '#00ff00', '#ffff00', '#ff00ff'];
        var paintMode = false;
        var hiddenColors = {};
        var globalUpdatePaletteUI = null;
        
        function applyVisibility() {
            drawnItems.eachLayer(function(layer) {
                var el = layer.getElement ? layer.getElement() : null;
                if (el) {
                    if (hiddenColors[layer.options.color]) {
                        el.style.display = 'none';
                    } else {
                        el.style.display = '';
                    }
                }
            });
        }
        
        // --- UNDO SYSTEM ---
        var undoStack = [];
        
        function pushUndo(action) {
            undoStack.push(action);
            if (undoStack.length > 100) undoStack.shift();
        }

        function performUndo() {
            if (undoStack.length === 0) return;
            var action = undoStack.pop();
            if (action.type === 'CREATE') {
                drawnItems.removeLayer(action.layer);
            } else if (action.type === 'PAINT') {
                paintLayer(action.layer, action.oldColor, false);
            } else if (action.type === 'POPUP') {
                action.layer.unbindPopup();
            } else if (action.type === 'DELETE') {
                drawnItems.addLayer(action.layer);
            }
            applyVisibility();
        }

        // --- KEYBOARD & HOTKEYS ---
        document.addEventListener('keydown', function(e) {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            var key = e.key.toLowerCase();

            // Ctrl + Z (Undo)
            if (e.ctrlKey && key === HOTKEYS.UNDO) {
                var handledByTool = false;
                try {
                    var modes = drawControl._toolbars.draw._modes;
                    for (var t in modes) {
                        var handler = modes[t].handler;
                        if (handler && handler.enabled() && typeof handler.deleteLastVertex === 'function') {
                            if (handler._markers && handler._markers.length > 0) {
                                handler.deleteLastVertex();
                                handledByTool = true;
                            }
                        }
                    }
                } catch(err) {}

                if (!handledByTool) {
                    performUndo();
                }
                
                e.preventDefault();
                return;
            }

            if (e.key === 'Control') {
                map.dragging.enable();
                map.getContainer().style.cursor = 'grab';
            }

            if (e.ctrlKey) return; 

            function triggerTool(selector) {
                var el = document.querySelector(selector);
                if (el) el.click();
            }

            switch(key) {
                case HOTKEYS.LINE: triggerTool('.leaflet-draw-draw-polyline'); break;
                case HOTKEYS.CIRCLE: triggerTool('.leaflet-draw-draw-circle'); break;
                case HOTKEYS.MARKER: triggerTool('.leaflet-draw-draw-marker'); break;
                case HOTKEYS.POLYGON: triggerTool('.leaflet-draw-draw-polygon'); break;
                case HOTKEYS.RECTANGLE: triggerTool('.leaflet-draw-draw-rectangle'); break;
                case HOTKEYS.PAINT_MODE: togglePaintMode(); break;
            }
        });

        document.addEventListener('keyup', function(e) {
            if (e.key === 'Control') {
                var isDrawing = false;
                try {
                    var modes = drawControl._toolbars.draw._modes;
                    for (var t in modes) {
                        if (modes[t].handler.enabled()) isDrawing = true;
                    }
                } catch(err) {}
                
                if (isDrawing) {
                    map.dragging.disable();
                }
                map.getContainer().style.cursor = '';
            }
        });

        map.getContainer().addEventListener('click', function(e) {
            if (e.ctrlKey) {
                e.stopPropagation();
            }
        }, true);
        map.getContainer().addEventListener('mousedown', function(e) {
            if (e.ctrlKey) {
                map.getContainer().style.cursor = 'grabbing';
            }
        }, true);
        map.getContainer().addEventListener('mouseup', function(e) {
            if (e.ctrlKey) {
                map.getContainer().style.cursor = 'grab';
            }
        }, true);

        function getMarkerIcon(color) {
            var svg = `<svg viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg" style="width:24px;height:36px;"><path d="M12 0C5.373 0 0 5.373 0 12c0 7.5 12 24 12 24s12-16.5 12-24c0-6.627-5.373-12-12-12z" fill="${color}" stroke="#000" stroke-width="1"/><circle cx="12" cy="12" r="5" fill="#fff"/></svg>`;
            return L.divIcon({
                className: 'custom-svg-marker',
                html: svg,
                iconSize: [24, 36],
                iconAnchor: [12, 36],
                popupAnchor: [0, -36]
            });
        }

        var drawControl = new L.Control.Draw({
            edit: { featureGroup: drawnItems },
            draw: {
                polygon: { shapeOptions: { color: currentColor }, guideLayers: [drawnItems], snapDistance: 15 },
                polyline: { shapeOptions: { color: currentColor }, guideLayers: [drawnItems], snapDistance: 15 },
                rectangle: { shapeOptions: { color: currentColor }, guideLayers: [drawnItems], snapDistance: 15 },
                circle: { shapeOptions: { color: currentColor } },
                marker: { icon: getMarkerIcon(currentColor), guideLayers: [drawnItems], snapDistance: 15 },
                circlemarker: false
            }
        });
        map.addControl(drawControl);

        function updateDrawColors() {
            drawControl.setDrawingOptions({
                polygon: { shapeOptions: { color: currentColor } },
                polyline: { shapeOptions: { color: currentColor } },
                rectangle: { shapeOptions: { color: currentColor } },
                circle: { shapeOptions: { color: currentColor } },
                marker: { icon: getMarkerIcon(currentColor) }
            });
            
            try {
                var drawModes = drawControl._toolbars.draw._modes;
                for (var type in drawModes) {
                    var handler = drawModes[type].handler;
                    if (handler && handler.enabled()) {
                        if (handler.options.shapeOptions) handler.options.shapeOptions.color = currentColor;
                        if (type === 'marker') handler.options.icon = getMarkerIcon(currentColor);
                        
                        if (handler._shape && handler._shape.setStyle) handler._shape.setStyle({color: currentColor});
                        if (handler._poly && handler._poly.setStyle) handler._poly.setStyle({color: currentColor});
                        if (handler._mouseMarker && type === 'marker') handler._mouseMarker.setIcon(getMarkerIcon(currentColor));
                    }
                }
            } catch(e) {}
        }

        function paintLayer(layer, color, saveUndo = true) {
            if (saveUndo && layer.options.color) {
                pushUndo({ type: 'PAINT', layer: layer, oldColor: layer.options.color });
            }
            layer.options.color = color;
            if (layer instanceof L.Marker) {
                layer.setIcon(getMarkerIcon(color));
            } else if (layer.setStyle) {
                layer.setStyle({ color: color, fillColor: color });
            }
            applyVisibility();
        }

        var itemCounter = 1;

        function bindLayerEvents(layer) {
            layer.on('click', function(e) {
                if (paintMode) {
                    paintLayer(layer, currentColor, true);
                    L.DomEvent.stopPropagation(e);
                }
            });
        }

        map.on(L.Draw.Event.CREATED, function (event) {
            var layer = event.layer;
            
            var typeName = event.layerType.charAt(0).toUpperCase() + event.layerType.slice(1);
            var tagId = typeName + "_" + itemCounter++;
            layer.options.tagId = tagId;
            layer.bindTooltip(tagId, {permanent: false, direction: 'center', className: 'auto-tag-tooltip'});

            paintLayer(layer, currentColor, false);
            bindLayerEvents(layer);
            drawnItems.addLayer(layer);
            pushUndo({ type: 'CREATE', layer: layer });
            applyVisibility();
        });

        map.on(L.Draw.Event.DELETED, function (event) {
            event.layers.eachLayer(function (layer) {
                pushUndo({ type: 'DELETE', layer: layer });
            });
        });

        var paintBtn;
        function togglePaintMode() {
            paintMode = !paintMode;
            if (paintBtn) {
                paintBtn.innerHTML = paintMode ? '🖌️ Paint Mode: ON' : '🖌️ Paint Mode: OFF';
                paintBtn.style.backgroundColor = paintMode ? '#ffff99' : '';
            }
        }

        var CustomToolsControl = L.Control.extend({
            options: { position: 'topright' },
            onAdd: function (map) {
                var container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
                container.style.backgroundColor = 'white';
                container.style.padding = '8px';
                container.style.display = 'flex';
                container.style.flexDirection = 'column';
                container.style.gap = '8px';
                L.DomEvent.disableClickPropagation(container);

                var colorRow = document.createElement('div');
                colorRow.style.display = 'flex';
                colorRow.style.alignItems = 'center';
                colorRow.style.gap = '5px';
                
                var colorInput = document.createElement('input');
                colorInput.type = 'color';
                colorInput.value = currentColor;
                colorInput.style.cursor = 'pointer';
                
                colorInput.onchange = function(e) {
                    currentColor = e.target.value;
                    updateDrawColors();
                };

                var customColorLabel = document.createElement('span');
                customColorLabel.innerHTML = 'Custom Color';
                customColorLabel.style.fontSize = '12px';

                colorRow.appendChild(colorInput);
                colorRow.appendChild(customColorLabel);
                container.appendChild(colorRow);

                // Palette Dropdown Button
                var paletteBtn = document.createElement('button');
                paletteBtn.innerHTML = '🎨 Color Palette ▼';
                paletteBtn.style.cursor = 'pointer';
                paletteBtn.style.padding = '4px';
                
                var palettePanel = document.createElement('div');
                palettePanel.style.display = 'none';
                palettePanel.style.flexDirection = 'column';
                palettePanel.style.gap = '8px';
                palettePanel.style.border = '1px solid #ccc';
                palettePanel.style.padding = '6px';
                palettePanel.style.backgroundColor = '#f9f9f9';
                
                var paletteGrid = document.createElement('div');
                paletteGrid.style.display = 'flex';
                paletteGrid.style.flexWrap = 'wrap';
                paletteGrid.style.gap = '4px';
                paletteGrid.style.maxWidth = '140px';

                function updatePaletteUI() {
                    paletteGrid.innerHTML = '';
                    colorPalette.forEach(function(c) {
                        var box = document.createElement('div');
                        box.style.width = '20px';
                        box.style.height = '20px';
                        box.style.backgroundColor = c;
                        box.style.border = '1px solid #000';
                        box.style.cursor = 'pointer';
                        box.onclick = function() {
                            currentColor = c;
                            colorInput.value = c;
                            updateDrawColors();
                            palettePanel.style.display = 'none'; // auto close
                        };
                        paletteGrid.appendChild(box);
                    });
                }
                globalUpdatePaletteUI = updatePaletteUI;

                var loadPaletteBtn = document.createElement('button');
                loadPaletteBtn.innerHTML = '📥 Bulk Import';
                loadPaletteBtn.style.cursor = 'pointer';
                loadPaletteBtn.style.fontSize = '11px';
                loadPaletteBtn.style.padding = '2px';
                
                loadPaletteBtn.onclick = function() {
                    var input = prompt("Paste your color palette (comma or space separated hex codes):\ne.g. #FF0000, #00FF00, #0000FF");
                    if (input) {
                        var matches = input.match(/#[0-9a-fA-F]{3,6}/g);
                        if (matches && matches.length > 0) {
                            colorPalette = matches.map(m => {
                                if (m.length === 4) {
                                    return '#' + m[1]+m[1] + m[2]+m[2] + m[3]+m[3];
                                }
                                return m.toLowerCase();
                            });
                            updatePaletteUI();
                        } else {
                            alert("No valid hex codes found. Make sure they start with #.");
                        }
                    }
                };

                palettePanel.appendChild(paletteGrid);
                palettePanel.appendChild(loadPaletteBtn);
                
                paletteBtn.onclick = function() {
                    if (palettePanel.style.display === 'none') {
                        updatePaletteUI();
                        palettePanel.style.display = 'flex';
                    } else {
                        palettePanel.style.display = 'none';
                    }
                };

                container.appendChild(paletteBtn);
                container.appendChild(palettePanel);

                paintBtn = document.createElement('button');
                paintBtn.innerHTML = '🖌️ Paint Mode: OFF';
                paintBtn.style.cursor = 'pointer';
                paintBtn.style.padding = '4px';
                paintBtn.onclick = togglePaintMode;
                container.appendChild(paintBtn);

                // Layers Button
                var layersBtn = document.createElement('button');
                layersBtn.innerHTML = '👁️ Layers (Colors) ▼';
                layersBtn.style.cursor = 'pointer';
                layersBtn.style.padding = '4px';
                
                var layersPanel = document.createElement('div');
                layersPanel.style.display = 'none';
                layersPanel.style.flexDirection = 'column';
                layersPanel.style.gap = '4px';
                layersPanel.style.border = '1px solid #ccc';
                layersPanel.style.padding = '4px';
                layersPanel.style.backgroundColor = '#f9f9f9';
                
                layersBtn.onclick = function() {
                    if (layersPanel.style.display === 'none') {
                        refreshLayersPanel();
                        layersPanel.style.display = 'flex';
                    } else {
                        layersPanel.style.display = 'none';
                    }
                };

                function refreshLayersPanel() {
                    layersPanel.innerHTML = '';
                    var uniqueColors = new Set();
                    drawnItems.eachLayer(function(layer) {
                        if (layer.options.color) uniqueColors.add(layer.options.color.toLowerCase());
                    });

                    if (uniqueColors.size === 0) {
                        layersPanel.innerHTML = '<span style="font-size:12px;color:#888;">No items yet</span>';
                        return;
                    }

                    uniqueColors.forEach(function(c) {
                        var row = document.createElement('div');
                        row.style.display = 'flex';
                        row.style.alignItems = 'center';
                        row.style.gap = '8px';
                        
                        var checkbox = document.createElement('input');
                        checkbox.type = 'checkbox';
                        checkbox.checked = !hiddenColors[c];
                        checkbox.style.margin = '0';
                        
                        var swatch = document.createElement('div');
                        swatch.style.width = '12px';
                        swatch.style.height = '12px';
                        swatch.style.backgroundColor = c;
                        swatch.style.border = '1px solid #000';
                        
                        var label = document.createElement('span');
                        label.innerHTML = c;
                        label.style.fontSize = '12px';
                        label.style.fontFamily = 'monospace';

                        checkbox.onchange = function(e) {
                            if (e.target.checked) {
                                delete hiddenColors[c];
                            } else {
                                hiddenColors[c] = true;
                            }
                            applyVisibility();
                        };

                        row.appendChild(checkbox);
                        row.appendChild(swatch);
                        row.appendChild(label);
                        layersPanel.appendChild(row);
                    });
                }

                container.appendChild(layersBtn);
                container.appendChild(layersPanel);

                var saveBtn = document.createElement('button');
                saveBtn.innerHTML = '💾 Save GeoJSON';
                saveBtn.style.cursor = 'pointer';
                saveBtn.style.padding = '4px';
                saveBtn.onclick = saveGeoJSON;
                
                var loadLabel = document.createElement('label');
                loadLabel.innerHTML = '📂 Load GeoJSON';
                loadLabel.style.cursor = 'pointer';
                loadLabel.style.border = '1px solid #ccc';
                loadLabel.style.backgroundColor = '#efefef';
                loadLabel.style.padding = '4px';
                loadLabel.style.textAlign = 'center';
                loadLabel.style.fontSize = '12px';
                loadLabel.style.display = 'block';

                var fileInput = document.createElement('input');
                fileInput.type = 'file';
                fileInput.accept = '.geojson,.json';
                fileInput.style.display = 'none';
                fileInput.onchange = loadGeoJSON;
                loadLabel.appendChild(fileInput);

                container.appendChild(saveBtn);
                container.appendChild(loadLabel);

                return container;
            }
        });
        map.addControl(new CustomToolsControl());

        function saveGeoJSON() {
            drawnItems.eachLayer(function(layer) {
                layer.feature = layer.feature || { type: 'Feature', properties: {} };
                layer.feature.properties.color = layer.options.color;
                
                if (layer instanceof L.Circle) {
                    layer.feature.properties.isCircle = true;
                    layer.feature.properties.radius = layer.getRadius();
                }
                
                if (layer.options.tagId) {
                    layer.feature.properties.tagId = layer.options.tagId;
                }
            });

            var data = drawnItems.toGeoJSON();
            data.ommColorPalette = colorPalette;

            var blob = new Blob([JSON.stringify(data, null, 2)], {type: "application/json"});
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = "map_annotations.geojson";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }

        function loadGeoJSON(e) {
            var file = e.target.files[0];
            if (!file) return;
            var reader = new FileReader();
            reader.onload = function(e) {
                try {
                    var data = JSON.parse(e.target.result);
                    
                    if (data.ommColorPalette && Array.isArray(data.ommColorPalette)) {
                        colorPalette = data.ommColorPalette;
                        if (globalUpdatePaletteUI) globalUpdatePaletteUI();
                    }
                    L.geoJSON(data, {
                        pointToLayer: function (feature, latlng) {
                            var color = feature.properties.color || '#3388ff';
                            if (feature.properties.isCircle) {
                                return L.circle(latlng, { radius: feature.properties.radius, color: color, fillColor: color });
                            }
                            return L.marker(latlng, {icon: getMarkerIcon(color)});
                        },
                        onEachFeature: function (feature, layer) {
                            if (feature.properties) {
                                if (feature.properties.color) {
                                    paintLayer(layer, feature.properties.color, false);
                                }
                                if (feature.properties.tagId) {
                                    layer.options.tagId = feature.properties.tagId;
                                    layer.bindTooltip(feature.properties.tagId, {permanent: false, direction: 'center', className: 'auto-tag-tooltip'});
                                }
                            }
                            bindLayerEvents(layer);
                            drawnItems.addLayer(layer);
                        }
                    });
                    applyVisibility();
                } catch (err) {
                    alert("Failed to load file. Ensure it's a valid GeoJSON.");
                }
            };
            reader.readAsText(file);
            e.target.value = '';
        }
    }
})();

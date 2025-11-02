// Auto-Rotate Module - V13 Compatible
// Updated for Foundry VTT V13 ApplicationV2 architecture

const MODULE_SCOPE = 'autorotate';

//// Core Functions ////

function getSetting(key){
    return game.settings.get(MODULE_SCOPE, key);
}

function registerSetting(key, value, link){
    const typ = value.type;
    if (value?.type?.prototype instanceof FormApplication) {
        return game.settings.registerMenu(MODULE_SCOPE, key, value);
    }

    const originalOnChange = value.onChange;
    if (link != null) {
        if (originalOnChange != null) {
            value.onChange = function (v) {
                link[key] = v;
                originalOnChange(v);
            }
        } else {
            value.onChange = function (v) {
                link[key] = v;
            }
        }
    }

    if (value.default === undefined && link[key] !== undefined){
        value.default = link[key]
    }

    const result = game.settings.register(MODULE_SCOPE, key, value);
    if (value.onChange != null){
        value.onChange(getSetting(key));
    }
    return result;
}

function registerSettings(link, settings){
    for (var [key, value] of Object.entries(settings)){
        registerSetting(key, value, link);
    }
}

function pointToAngle(x, y){
    return toDegrees(Math.atan2(y, x));
}

function toDegrees(radians) {
    return radians / (Math.PI / 180);
}

function normalizeDegrees(degrees) {
    const delta = degrees % 360;
    return delta < 0 ? delta + 360 : delta;
}

//// Settings ////
const settings = {
    version: "",
    defaultRotationMode: "regular"
}

//// Utility Functions ////

function getFlag(document, flag){
    return document.flags[MODULE_SCOPE]?.[flag];
}

function shouldRotate(tokenDocument){
    const enabled = getFlag(tokenDocument, 'enabled');
    return (
        (enabled === true) ||
        (enabled == null && settings.defaultRotationMode === 'automatic')
    )
}

function rotationOffset(tokenDocument){
    const offset = getFlag(tokenDocument, 'offset');
    if (offset == null) return 0;
    return offset;
}

function rotationFromPositionDelta(deltaX, deltaY, offset){
    return normalizeDegrees(
        pointToAngle(deltaX, deltaY) - 90 + offset
    );
}

//// Hook Handlers ////

async function rotateTokenOnPreUpdate(tokenDocument, change, options, userId) {
    if (userId !== game.user.id || !shouldRotate(tokenDocument) || options.RidingMovement) {
        return;
    }

    const newX = change.x || tokenDocument.x;
    const newY = change.y || tokenDocument.y;
    if (newX === tokenDocument.x && newY === tokenDocument.y) {
        return;
    }

    const deltaX = newX - tokenDocument.x;
    const deltaY = newY - tokenDocument.y;
    const offset = rotationOffset(tokenDocument);

    change.rotation = rotationFromPositionDelta(deltaX, deltaY, offset);

    // Stop movement but allow rotation when Shift + Arrow keys are pressed
    const SHIFT = 'Shift';
    const STOP_MOVEMENT = (
        game.keyboard.downKeys.has(SHIFT) &&
        (
            game.keyboard.downKeys.has('ArrowUp')   ||
            game.keyboard.downKeys.has('ArrowDown') ||
            game.keyboard.downKeys.has('ArrowLeft') ||
            game.keyboard.downKeys.has('ArrowRight')
        )
    );
    if (STOP_MOVEMENT) {
        change.x = undefined;
        change.y = undefined;
    }
}

async function rotateTokensOnTarget(user, targetToken, targetActive) {
    if (!targetActive || user.id !== game.user.id) {
        return;
    }

    const controlled = canvas.tokens.controlled;
    if (controlled.length === 0) {
        return;
    }

    const updates = controlled
        .filter(t => shouldRotate(t.document))
        .filter(t => t.id !== targetToken.id)
        .map(controlledToken => ({
            _id: controlledToken.id,
            rotation: rotationFromPositionDelta(
                targetToken.document.x - controlledToken.document.x,
                targetToken.document.y - controlledToken.document.y,
                rotationOffset(controlledToken.document)
            )
        }));
    await canvas.scene.updateEmbeddedDocuments("Token", updates);
}

// V13 ApplicationV2-compatible token config injection
async function injectAutoRotateOptions(app, html, data){
    // In V13 ApplicationV2, access the document via app.document
    const document = app.document;
    if (!document) {
        console.warn("AutoRotate: Could not access token document");
        return;
    }

    const enabled = document.flags[MODULE_SCOPE]?.["enabled"]
    const offset = document.flags[MODULE_SCOPE]?.["offset"]

    // Build the fieldset HTML directly like Tactical Grid does
    const fieldset = $(`
  <fieldset>
    <legend>Auto-Rotate</legend>
    <div class="form-group">
      <label>Enable Auto-Rotate</label>
      <div class="form-fields">
        <select name="flags.${MODULE_SCOPE}.enabled" data-dtype="JSON">
          <option ${enabled == null ? 'selected' : ''} value="null">Global Default</option>
          <option ${enabled === true ? 'selected' : ''} value="true">On</option>
          <option ${enabled === false ? 'selected' : ''} value="false">Off</option>
        </select>
      </div>
    </div>
    <div class="form-group">
      <label>Rotation Offset</label>
      <div class="form-fields">
        <input type="number" value="${offset ?? 0}" step="any" name="flags.${MODULE_SCOPE}.offset" data-dtype="Number">
      </div>
    </div>
  </fieldset>
    `);

    // Insert after lockRotation field in the Appearance tab
    const target = $(app.element).find('[name="lockRotation"]').closest(".form-group");
    if (target.length > 0) {
        target.after(fieldset);
    } else {
        // Fallback: append to the form
        $(app.element).find('form').append(fieldset);
    }

    // Adjust window height to fit new content
    app.setPosition({height: "auto"});
}

//// Initialize ////

Hooks.on('ready', () => {
    registerSettings(
        settings,
        {
            version: {
                scope: "world"
            },
            defaultRotationMode: {
                name: "Default Rotation Mode",
                hint: "The rotation mode used for tokens that do not have " +
                      "automatic rotation explicitly enabled or disabled.",
                scope: "world",
                config: true,
                choices: {
                    "regular"  : "Regular",
                    "automatic": "Automatic",
                },
            }
        },
    );

    // Check for conflicting core setting
    const coreAutoRotate = game.settings.get("core", "tokenAutoRotate");
    if (coreAutoRotate) {
        ui.notifications.warn(
            "Auto-Rotate Module: Foundry's core automatic token rotation is enabled. " +
            "Please disable it in Core Settings" +
            "to avoid conflicts with this module.",
            { permanent: true }
        );
    }
});

Hooks.on("preUpdateToken",    rotateTokenOnPreUpdate);
Hooks.on("targetToken",       rotateTokensOnTarget);
Hooks.on("renderTokenConfig", injectAutoRotateOptions);

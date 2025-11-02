import * as core from "./core.js";

//// Settings ////
const settings = {
    version: "",
    defaultRotationMode: "regular"
}

Hooks.on('ready', () => {
    core.registerSettings(
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
})


//// Utility Functions ////


const UP = 'ArrowUp';
const DOWN = 'ArrowDown';
const LEFT = 'ArrowLeft';
const RIGHT = 'ArrowRight';
const SHIFT = 'Shift';


function getFlag(document, flag){
    return document.flags[core.MODULE_SCOPE]?.[flag];
}


function shouldRotate(tokenDocument){
    // `null` if not set, otherwise `true` or `false`
    const enabled = getFlag(tokenDocument, 'enabled');
    return (
        (
            enabled === true
        ) || (
            enabled == null &&
            settings.defaultRotationMode === 'automatic'
        )
    )
}


function rotationOffset(tokenDocument){
    const offset = getFlag(tokenDocument, 'offset');
    if (offset == null) return 0;
    return offset;
}


function rotationFromPositionDelta(deltaX, deltaY, offset){
    // Convert our delta to an angle, then adjust for the fact that the
    // rotational perspective in Foundry is shifted 90 degrees
    // counterclockwise.
    return core.normalizeDegrees(
        core.pointToAngle(deltaX, deltaY) - 90 + offset
    );
}


//// Hooks ////


async function rotateTokenOnPreUpdate(tokenDocument, change, options, userId) {
    const cont = (
        userId === game.user.id &&
        shouldRotate(tokenDocument) &&
		!options.RidingMovement //for rideable compatibility
    )
    if (!cont){
        return;
    }

    // At least one part of the token's location must be changing.
    // If a coordinate isn't defined in the set of data to update, we default
    // to the token's current position.
    const newX = change.x || tokenDocument.x;
    const newY = change.y || tokenDocument.y;
    if (newX === tokenDocument.x && newY === tokenDocument.y) {
        return;
    }

    const deltaX = newX - tokenDocument.x;
    const deltaY = newY - tokenDocument.y;

    const offset = rotationOffset(tokenDocument);

    change.rotation = rotationFromPositionDelta(deltaX, deltaY, offset);

    const STOP_MOVEMENT = (
        game.keyboard.downKeys.has(SHIFT) &&
        (
            game.keyboard.downKeys.has(UP)   ||
            game.keyboard.downKeys.has(DOWN) ||
            game.keyboard.downKeys.has(LEFT) ||
            game.keyboard.downKeys.has(RIGHT)
        )
    );
    if (STOP_MOVEMENT) {
        change.x = undefined;
        change.y = undefined;
    }
}


async function rotateTokensOnTarget(user, targetToken, targetActive) {
    const cont = (
        targetActive             &&
        user.id === game.user.id
    )
    if (!cont){
        return;
    }

    // The user must have at least one token controlled
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


// Updated for V13 ApplicationV2 compatibility
async function injectAutoRotateOptions(app, html, data){
    const enabled = data.object.flags[core.MODULE_SCOPE]?.["enabled"]
    const offset = data.object.flags[core.MODULE_SCOPE]?.["offset"]

    // V13 uses ApplicationV2, so we need to wait for the DOM to be fully rendered
    // and use a more robust selector
    const form = html.find("fieldset.appearance, div[data-tab='appearance'], .tab[data-tab='appearance']").first();

    if (form.length === 0) {
        // Fallback: try to find any appearance-related container
        console.warn("AutoRotate: Could not find appearance tab, trying fallback selector");
        const fallback = html.find(".tab.active").first();
        if (fallback.length === 0) {
            console.error("AutoRotate: Could not inject settings - no suitable container found");
            return;
        }
    }

    let snippet = await renderTemplate(
        "modules/autorotate/templates/token-config-snippet.html",
        {
            selectDefault: enabled == null,
            selectYes    : enabled === true,
            selectNo     : enabled === false,
            offsetToSet  : offset,
        }
    );

    // In V13, we may need to append to a different location
    const targetElement = form.length > 0 ? form : html.find("form").first();
    targetElement.append(snippet);
}

Hooks.on("preUpdateToken",    rotateTokenOnPreUpdate);
Hooks.on("targetToken",       rotateTokensOnTarget);
Hooks.on("renderTokenConfig", injectAutoRotateOptions);

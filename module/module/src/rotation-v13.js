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


// V13-specific implementation using ApplicationV2 patterns
async function injectAutoRotateOptions(app, html, data){
    const enabled = data.object.flags[core.MODULE_SCOPE]?.["enabled"]
    const offset = data.object.flags[core.MODULE_SCOPE]?.["offset"]

    console.log("AutoRotate: renderTokenConfig hook fired");
    console.log("AutoRotate: html element", html);
    console.log("AutoRotate: data structure", data);

    // Try multiple selectors for V13 compatibility
    let form = null;
    const selectors = [
        "fieldset.appearance",                  // V13 fieldset approach
        ".tab[data-tab='appearance']",          // Tab-based approach
        "div[data-tab='appearance']",           // Old V11 approach
        ".window-content form",                 // Generic form
        "form fieldset:last-of-type",           // Last fieldset in form
    ];

    for (const selector of selectors) {
        form = html.find(selector).first();
        if (form.length > 0) {
            console.log(`AutoRotate: Found target using selector: ${selector}`);
            break;
        }
    }

    if (!form || form.length === 0) {
        console.error("AutoRotate: Could not find suitable injection point");
        console.log("AutoRotate: Available elements:", html.find("*").map((i, el) => el.tagName + (el.className ? '.' + el.className : '')).get());
        return;
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

    // Append the snippet
    form.append(snippet);
    console.log("AutoRotate: Settings injected successfully");
}

Hooks.on("preUpdateToken",    rotateTokenOnPreUpdate);
Hooks.on("targetToken",       rotateTokensOnTarget);
Hooks.on("renderTokenConfig", injectAutoRotateOptions);

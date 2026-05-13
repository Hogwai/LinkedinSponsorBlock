import { logger } from './logger.js';

const DEFAULT_OPTIONS = {
    inactivityThresholdMs: 60_000,
    protectionWindowMs: 4_000,
    userInputWindowMs: 1_200,
    topJumpThresholdPx: 80,
    minRestoreScrollY: 250
};

// TEMPORARY diagnostic logs for validating LinkedIn inactivity refresh behavior.
// Remove before release once the behavior has been verified manually.
const TEMP_DIAGNOSTIC_LOGS = true;

function diagnosticLog(message, details = null) {
    if (!TEMP_DIAGNOSTIC_LOGS) return;
    if (details) {
        console.info(`[LSB anti-refresh] ${message}`, details);
        return;
    }
    console.info(`[LSB anti-refresh] ${message}`);
}

export function createInactivityRefreshPreventer({ isActivePage, options = {} } = {}) {
    const config = { ...DEFAULT_OPTIONS, ...options };

    let enabled = false;
    let started = false;
    let protectingUntil = 0;
    let hiddenAt = 0;
    let blurredAt = 0;
    let lastUserScrollAt = 0;
    let lastKnownScrollY = Math.max(0, window.scrollY || 0);
    let lastScrollTarget = window;
    let protectedScrollY = 0;
    let protectedScrollTarget = window;
    let restoreFrame = null;

    function getRootScrollY() {
        return Math.max(
            0,
            window.scrollY || 0,
            window.pageYOffset || 0,
            document.scrollingElement?.scrollTop || 0,
            document.documentElement?.scrollTop || 0,
            document.body?.scrollTop || 0
        );
    }

    function normalizeScrollTarget(target) {
        if (!target || target === document || target === document.body || target === document.documentElement) {
            return window;
        }
        return target;
    }

    function currentScrollY(target = lastScrollTarget) {
        const normalizedTarget = normalizeScrollTarget(target);
        if (normalizedTarget !== window && typeof normalizedTarget.scrollTop === 'number') {
            return Math.max(0, normalizedTarget.scrollTop || 0);
        }
        return getRootScrollY();
    }

    function isPageEligible() {
        return typeof isActivePage === 'function' ? isActivePage() : true;
    }

    function rememberScrollPosition(target = lastScrollTarget) {
        const eligible = isPageEligible();
        if (!enabled || !eligible || document.hidden) return;

        const normalizedTarget = normalizeScrollTarget(target);
        const currentY = currentScrollY(normalizedTarget);
        if (currentY > config.minRestoreScrollY) {
            lastKnownScrollY = currentY;
            lastScrollTarget = normalizedTarget;
        }
    }

    function capturePositionForDiagnostic(reason) {
        const currentY = currentScrollY();
        if (currentY > config.minRestoreScrollY) {
            lastKnownScrollY = currentY;
            diagnosticLog(`📍 ${reason} Position utilisable enregistrée : ${currentY}px.`);
            return;
        }

        if (lastKnownScrollY > config.minRestoreScrollY) {
            diagnosticLog(`📍 ${reason} Position utilisable déjà enregistrée : ${lastKnownScrollY}px.`);
            return;
        }

        diagnosticLog(
            `⚠️ ${reason} Position actuelle : ${currentY}px. Test non exploitable : il faut être plus bas que ${config.minRestoreScrollY}px pour pouvoir vérifier une restauration.`
        );
    }

    function markUserInput() {
        lastUserScrollAt = Date.now();
    }

    function userScrolledRecently(now = Date.now()) {
        return now - lastUserScrollAt < config.userInputWindowMs;
    }

    function restoreProtectedScrollPosition() {
        if (protectedScrollTarget !== window && typeof protectedScrollTarget.scrollTo === 'function') {
            protectedScrollTarget.scrollTo({ top: protectedScrollY, left: 0, behavior: 'instant' });
        } else if (protectedScrollTarget !== window && typeof protectedScrollTarget.scrollTop === 'number') {
            protectedScrollTarget.scrollTop = protectedScrollY;
        } else {
            window.scrollTo({ top: protectedScrollY, left: 0, behavior: 'instant' });
        }
    }

    function beginProtectionIfInactive(inactiveAt = hiddenAt || blurredAt) {
        const now = Date.now();
        const inactiveFor = inactiveAt ? now - inactiveAt : 0;
        hiddenAt = 0;
        blurredAt = 0;

        const eligible = isPageEligible();
        if (!enabled || !eligible) {
            if (inactiveAt) {
                diagnosticLog(
                    !enabled
                        ? '⏸️ Protection non testée : l’option est désactivée.'
                        : '⏭️ Protection non testée : on n’est pas sur le fil LinkedIn.'
                );
            }
            return;
        }

        if (inactiveFor >= config.inactivityThresholdMs && lastKnownScrollY >= config.minRestoreScrollY) {
            protectingUntil = now + config.protectionWindowMs;
            protectedScrollY = lastKnownScrollY;
            protectedScrollTarget = lastScrollTarget;
            logger.info(`Protecting scroll position after ${Math.round(inactiveFor / 1000)}s inactivity`);
            diagnosticLog(
                `🛡️ Protection active pendant ${Math.round(config.protectionWindowMs / 1000)}s après ${Math.round(inactiveFor / 1000)}s d’inactivité. Position à protéger : ${protectedScrollY}px.`
            );
            return;
        }

        if (!inactiveAt) {
            return;
        }

        if (inactiveFor < config.inactivityThresholdMs) {
            diagnosticLog(
                `⏭️ Inactivité trop courte (${Math.round(inactiveFor / 1000)}s < ${Math.round(config.inactivityThresholdMs / 1000)}s). Pas de protection ouverte.`
            );
            return;
        }

        diagnosticLog(
            `⚠️ Aucune position exploitable n’a été enregistrée avant le retour d’inactivité (${lastKnownScrollY}px). Scrolle plus bas puis vérifie qu’un log “Position utilisable enregistrée” apparaît avant de laisser l’onglet inactif.`
        );
    }

    function onVisibilityChange() {
        if (document.hidden) {
            hiddenAt = Date.now();
            capturePositionForDiagnostic('Onglet caché.');
            return;
        }

        beginProtectionIfInactive();
    }

    function onBlur() {
        const eligible = isPageEligible();
        if (!enabled || !eligible || document.hidden) {
            return;
        }
        blurredAt = Date.now();
        capturePositionForDiagnostic('Fenêtre inactive.');
    }

    function onFocus() {
        beginProtectionIfInactive();
    }

    function onScroll(event) {
        const eligible = isPageEligible();
        if (!enabled || !eligible) {
            return;
        }

        const now = Date.now();
        const scrollTarget = normalizeScrollTarget(event?.target);
        const currentY = currentScrollY(scrollTarget);
        const isUnexpectedTopJump =
            now < protectingUntil &&
            !userScrolledRecently(now) &&
            currentY <= config.topJumpThresholdPx &&
            protectedScrollY >= config.minRestoreScrollY;

        if (!isUnexpectedTopJump) {
            if (now < protectingUntil) return;
            rememberScrollPosition(scrollTarget);
            return;
        }

        diagnosticLog(`⬆️ Retour en haut détecté par LinkedIn (${currentY}px). Restauration prévue vers ${protectedScrollY}px.`);

        if (restoreFrame !== null) cancelAnimationFrame(restoreFrame);
        restoreFrame = requestAnimationFrame(() => {
            restoreFrame = null;
            restoreProtectedScrollPosition();
            logger.info(`Restored scroll position to ${protectedScrollY}`);
            diagnosticLog(`✅ Position restaurée à ${protectedScrollY}px.`);
        });
    }

    function addListeners() {
        document.addEventListener('visibilitychange', onVisibilityChange, true);
        window.addEventListener('blur', onBlur, true);
        window.addEventListener('focus', onFocus, true);
        document.addEventListener('scroll', onScroll, { passive: true, capture: true });
        window.addEventListener('scroll', onScroll, { passive: true, capture: true });
        window.addEventListener('wheel', markUserInput, { passive: true, capture: true });
        window.addEventListener('touchstart', markUserInput, { passive: true, capture: true });
        window.addEventListener('pointerdown', markUserInput, { passive: true, capture: true });
        window.addEventListener('mousedown', markUserInput, { passive: true, capture: true });
        window.addEventListener('keydown', markUserInput, true);
    }

    function removeListeners() {
        document.removeEventListener('visibilitychange', onVisibilityChange, true);
        window.removeEventListener('blur', onBlur, true);
        window.removeEventListener('focus', onFocus, true);
        document.removeEventListener('scroll', onScroll, true);
        window.removeEventListener('scroll', onScroll, true);
        window.removeEventListener('wheel', markUserInput, true);
        window.removeEventListener('touchstart', markUserInput, true);
        window.removeEventListener('pointerdown', markUserInput, true);
        window.removeEventListener('mousedown', markUserInput, true);
        window.removeEventListener('keydown', markUserInput, true);
    }

    function start() {
        enabled = true;
        if (started) {
            return;
        }
        started = true;
        addListeners();
        diagnosticLog(`✅ Protection anti-refresh activée. Fil LinkedIn détecté : ${isPageEligible() ? 'oui' : 'non'}. Position actuelle : ${currentScrollY()}px.`);
        rememberScrollPosition();
    }

    function stop() {
        enabled = false;
        if (!started) {
            return;
        }
        started = false;
        removeListeners();
        protectingUntil = 0;
        protectedScrollY = 0;
        protectedScrollTarget = window;
        hiddenAt = 0;
        blurredAt = 0;
        if (restoreFrame !== null) {
            cancelAnimationFrame(restoreFrame);
            restoreFrame = null;
        }
        diagnosticLog('⏹️ Protection anti-refresh désactivée. Les écouteurs temporaires sont retirés.');
    }

    function setEnabled(value) {
        enabled = Boolean(value);
        if (enabled) start();
        else stop();
    }

    return { start, stop, setEnabled };
}

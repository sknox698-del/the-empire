import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const readSource = file => readFile(join(projectRoot, file), 'utf8');
const [html, styleSource, dataSource, engineSource, uiSource] = await Promise.all([
  readSource('index.html'),
  readSource('style.css'),
  readSource('data.js'),
  readSource('engine.js'),
  readSource('ui.js')
]);

for (const file of ['style.css', 'data.js', 'engine.js', 'ui.js']) {
  assert.match(html, new RegExp(`(?:href|src)=["']${file.replace('.', '\\.')}["']`), `${file} must be linked from index.html`);
}

assert.doesNotMatch(uiSource.match(/init\(\)\s*\{[\s\S]*?\n\s*\}/)?.[0] || '', /engine\.newGame/, 'UI initialization must not erase loaded saves');
assert.match(uiSource, /saveGame\(0, true\)/, 'autosave must run silently');
assert.match(styleSource, /#splash\s*\{[\s\S]*?overflow-y:\s*auto;/, 'the splash must scroll when enlarged text exceeds the viewport');
assert.match(styleSource, /\.splash-content\s*>\s*\*\s*\{\s*flex-shrink:\s*0;/, 'enlarged splash content must keep its natural height');

const context = vm.createContext({ console, Date, Math, JSON, setTimeout, clearTimeout });
vm.runInContext(`${dataSource}\n;globalThis.GAME_DATA = GAME_DATA;`, context, { filename: 'data.js' });
vm.runInContext(`${engineSource}\n;globalThis.EmpireEngine = EmpireEngine;`, context, { filename: 'engine.js' });
vm.runInContext(`${uiSource}\n;globalThis.EmpireUI = EmpireUI;`, context, { filename: 'ui.js' });

const engine = new context.EmpireEngine();
const initial = engine.newGame();
assert.equal(initial.day, 1);
assert.equal(initial.cash, context.GAME_DATA.startingCash);
assert.equal(initial.energy, context.GAME_DATA.startingEnergy);

const dashboard = { innerHTML: '' };
new context.EmpireUI(engine).renderDashboard(dashboard);
assert.match(dashboard.innerHTML, /Command center/);
assert.match(dashboard.innerHTML, /quick-action-grid/);
assert.match(dashboard.innerHTML, /data-tutorial-target="actions"/, 'dashboard actions must expose a tutorial target');
assert.match(dashboard.innerHTML, /quick-action-primary/, 'the recommended first action must have clear visual priority');
assert.match(dashboard.innerHTML, /Explore city/);

const tutorialUi = new context.EmpireUI(engine);
const tutorialSteps = tutorialUi.getGuidedTutorialSteps();
assert.equal(tutorialSteps.length, 6, 'the guided city tour must cover the complete onboarding flow');
assert.equal(tutorialSteps.at(-1).title, 'Make your first move in the Old Market.');
assert.match(html, /data-tutorial-target="resources"/, 'the resource bar must be available to the guided tour');
assert.match(html, /data-tutorial-target="navigation"/, 'the bottom navigation must be available to the guided tour');

const mapScreen = { innerHTML: '' };
new context.EmpireUI(engine).renderMap(mapScreen);
assert.match(mapScreen.innerHTML, /class="city-map-art"/, 'city map artwork must render');
assert.match(mapScreen.innerHTML, /class="roads"/, 'city map must include streets');
assert.match(mapScreen.innerHTML, /class="houses"/, 'city map must include houses');
assert.match(mapScreen.innerHTML, /class="commercial-buildings"/, 'city map must include buildings');
assert.equal((mapScreen.innerHTML.match(/class="map-location-pin/g) || []).length, context.GAME_DATA.locations.length, 'every game location must have a map marker');
assert.match(mapScreen.innerHTML, /Your Room, open now/, 'the player home must be available on the city map');

const assignmentEngine = new context.EmpireEngine();
assignmentEngine.newGame();
assert.equal(assignmentEngine.openBusiness('market_stall', 'old_market').success, true);
assert.equal(assignmentEngine.hireEmployee(context.GAME_DATA.employeeCandidates[0].id).success, true);
const assignmentBusiness = assignmentEngine.state.businesses[0];
const assignmentEmployee = assignmentEngine.state.employees[0];
const assignmentScreen = { innerHTML: '', scrollTop: 84 };
context.document = { getElementById: id => id === 'screen-content' ? assignmentScreen : null };
const assignmentUi = new context.EmpireUI(assignmentEngine);
assignmentUi.closeModal = () => {};
assignmentUi.showToast = () => {};
assignmentUi.updateResourceBar = () => {};
assignmentUi.renderBusinessDetail(assignmentScreen, { instanceId: assignmentBusiness.instanceId });
assert.match(assignmentScreen.innerHTML, /Assign Employee/, 'unassigned staff should show the assignment button');
assignmentUi.assignEmployee(assignmentEmployee.instanceId, assignmentBusiness.instanceId);
assert.match(assignmentScreen.innerHTML, new RegExp(assignmentEmployee.name), 'assigned employee must appear immediately');
assert.doesNotMatch(assignmentScreen.innerHTML, /Assign Employee/, 'assignment button must update immediately when the last slot is filled');
assert.equal(assignmentScreen.scrollTop, 84, 'assignment refresh must preserve the business screen scroll position');

const supportedEventEffects = new Set([
  'cash', 'clue', 'customerTrafficMultiplier', 'dailyRentMultiplier', 'daysDuration',
  'energy', 'energyCost', 'influence', 'juniorMorale', 'knowledge', 'leaveChance',
  'leverage', 'loyalty', 'morale', 'property', 'propertyDiscount', 'qualityBonus',
  'relationship', 'reliability', 'reputation', 'rivalAlliance', 'rivalRelationship',
  'saleValueMultiplier', 'seniorMorale', 'skill', 'supplyCost',
  'supplyCostMultiplier', 'trust', 'wageIncrease'
]);
for (const event of context.GAME_DATA.events) {
  for (const choice of event.choices) {
    for (const effect of Object.keys(choice.effects || {})) {
      assert(supportedEventEffects.has(effect), `event effect ${effect} must be implemented`);
    }
  }
}

const savedState = JSON.parse(JSON.stringify(initial));
savedState.cash = 777;
savedState.day = 9;
engine.loadState(savedState);
assert.equal(engine.getState().cash, 777, 'loaded cash should be preserved');
assert.equal(engine.getState().day, 9, 'loaded day should be preserved');

engine.newGame();
const businessData = context.GAME_DATA.businesses[0];
const originalSaleValue = businessData.averageSaleValue;
engine.state.businesses.push({
  instanceId: 'smoke-business',
  businessId: businessData.id,
  neighborhood: context.GAME_DATA.neighborhoods[0].id,
  upgradeLevel: 0,
  capacityBonus: 0
});
engine.state.activeEffects.push({ saleValueMultiplier: 1.5, daysRemaining: 1 });
engine.processBusinessDay();
assert.equal(businessData.averageSaleValue, originalSaleValue, 'temporary effects must not mutate master game data');

const originalRent = businessData.dailyRent;
const rentEvent = { title: 'Rent test', relatedCharacters: [], choices: [{ text: 'Accept', effects: { dailyRentMultiplier: 1.2 } }] };
assert.equal(engine.resolveEvent(rentEvent, 0).success, true);
assert.equal(businessData.dailyRent, originalRent, 'rent events must not mutate master game data');
assert.equal(engine.state.businesses[0].rentMultiplier, 1.2);

engine.state.energy = 0;
const energyEvent = { title: 'Energy test', relatedCharacters: [], choices: [{ text: 'Act', effects: { energyCost: 2 } }] };
assert.equal(engine.resolveEvent(energyEvent, 0).success, false);
assert.equal(engine.state.energy, 0, 'event energy cannot become negative');

const loanEngine = new context.EmpireEngine();
loanEngine.newGame();
loanEngine.state.reputation = 100;
loanEngine.state.characterRelationships.james_chen = 100;
const loanResult = loanEngine.requestLoan('small');
assert.equal(loanResult.success, true);
const loan = loanEngine.state.loans[0];
const cashAfterBorrowing = loanEngine.state.cash;
const totalRepayment = loan.totalRepayment;
for (let day = 0; day < loan.termDays; day++) loanEngine.processLoansDay();
assert.equal(loanEngine.state.cash, cashAfterBorrowing - totalRepayment, 'loan payments must not exceed total repayment');
assert.equal(loanEngine.state.loans.length, 0);

const dayBefore = engine.state.day;
engine.state.energy = 1;
engine.endDay();
assert.equal(engine.state.day, dayBefore + 1);
assert.equal(engine.state.energy, engine.state.maxEnergy);

console.log('Smoke tests passed: assets, saves, simulation data, and day progression.');

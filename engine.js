// ============================================================
// THE EMPIRE — Game Engine
// Core game state, simulation, and action processing
// ============================================================

class EmpireEngine {
  constructor() {
    this.state = null;
    this.seed = 0;
    this.eventCooldowns = {};
    this.tutorialFlags = {};
  }

  // ── Seeded Random ─────────────────────────────────
  seededRandom() {
    this.seed = (this.seed * 16807 + 0) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }

  seededRandomInt(min, max) {
    return Math.floor(this.seededRandom() * (max - min + 1)) + min;
  }

  // ── Initialize New Game ──────────────────────────
  newGame() {
    this.seed = (Date.now() % 2147483646) + 1;
    this.eventCooldowns = {};
    this.tutorialFlags = {};

    this.state = {
      version: GAME_DATA.version,
      day: 1,
      timeSlot: 0, // 0=Morning, 1=Midday, 2=Afternoon, 3=Evening
      cash: GAME_DATA.startingCash,
      energy: GAME_DATA.startingEnergy,
      maxEnergy: GAME_DATA.maxEnergy,
      reputation: 0,
      influence: 0,
      knowledge: 0,
      leverage: 0,
      propertyDiscount: 0,
      
      // Player upgrades
      playerUpgrades: [],
      
      // Businesses the player owns
      businesses: [],
      
      // Properties the player owns
      properties: [],
      
      // Employees currently hired
      employees: [],
      
      // Inventory for reselling
      inventory: [],
      
      // Active loans
      loans: [],
      
      // Character relationships (overlays on base data)
      characterRelationships: {},
      characterTrust: {},
      characterDialogueState: {},
      
      // Rival relationships
      rivalRelationships: {},
      rivalAlliances: [],
      
      // Discovered clues
      discoveredClues: [],
      
      // Mystery resolution
      mysteryResolved: false,
      mysteryResolution: null,
      
      // City Memory
      cityMemory: [],
      
      // News feed
      newsFeed: [],
      
      // Active event effects
      activeEffects: [],
      
      // Event history (for cooldowns)
      eventHistory: {},
      
      // Tutorial state
      tutorialCompleted: {},
      
      // Stats tracking
      totalEarned: 0,
      totalSpent: 0,
      totalDaysWorked: 0,
      businessesOpened: 0,
      employeesHired: 0,
      propertiesBought: 0,
      
      // Developer mode
      devMode: false,
      devUnlockBusinesses: false,
      
      // Save metadata
      saveTime: null,
      playTime: 0
    };

    // Initialize character relationships from base data
    GAME_DATA.characters.forEach(c => {
      this.state.characterRelationships[c.id] = c.startingRelationship;
      this.state.characterTrust[c.id] = c.startingTrust;
      this.state.characterDialogueState[c.id] = 'introduction';
    });

    // Initialize rival relationships
    GAME_DATA.rivalOrganizations.forEach(r => {
      this.state.rivalRelationships[r.id] = 0; // starts neutral
    });

    // First news entry
    this.addNews("You've arrived in the city with €100 and a dream. Time to get to work.");
    this.addCityMemory("Arrived in the city with €100.");

    this.triggerTutorial('game_start');

    return this.state;
  }

  // ── Load / Save ──────────────────────────────────
  loadState(savedState) {
    if (!savedState || typeof savedState !== 'object') throw new Error('Invalid save data.');

    // Add fields introduced by newer versions without losing saved progress.
    const defaults = this.newGame();
    this.state = {
      ...defaults,
      ...savedState,
      characterRelationships: { ...defaults.characterRelationships, ...(savedState.characterRelationships || {}) },
      characterTrust: { ...defaults.characterTrust, ...(savedState.characterTrust || {}) },
      characterDialogueState: { ...defaults.characterDialogueState, ...(savedState.characterDialogueState || {}) },
      rivalRelationships: { ...defaults.rivalRelationships, ...(savedState.rivalRelationships || {}) },
      rivalAlliances: Array.isArray(savedState.rivalAlliances) ? savedState.rivalAlliances : [],
      activeEffects: Array.isArray(savedState.activeEffects) ? savedState.activeEffects : [],
      eventHistory: savedState.eventHistory || {},
      tutorialCompleted: savedState.tutorialCompleted || {}
    };
    this.eventCooldowns = this.state.eventHistory;
    this.tutorialFlags = this.state.tutorialCompleted;
  }

  getState() {
    return this.state;
  }

  // ── Time & Energy ────────────────────────────────
  advanceTime() {
    this.state.timeSlot++;
    if (this.state.timeSlot >= GAME_DATA.timeSlotsPerDay) {
      this.endDay();
    }
    this.triggerTutorial('first_action');
  }

  endDay() {
    // Process all daily revenue, expenses, events
    this.state.timeSlot = 0;
    this.state.day++;
    this.state.energy = this.state.maxEnergy;
    this.state.totalDaysWorked++;
    
    // Process business revenue
    this.processBusinessDay();
    
    // Process loans
    this.processLoansDay();
    
    // Process employee wages
    this.processEmployeeWages();
    
    // Decay active effects
    this.state.activeEffects = this.state.activeEffects.filter(e => {
      e.daysRemaining--;
      return e.daysRemaining > 0;
    });
    
    // Rival actions
    this.processRivalActions();
    
    // Check for events
    this.checkRandomEvents();
    
    // Employee morale decay and personal events
    this.processEmployeeMorale();
    
    // Tutorial triggers
    if (this.state.day >= 3) this.triggerTutorial('day_3');
    
    // Auto-save
    this.state.saveTime = Date.now();
    this.addNews(`Day ${this.state.day} begins.`);
  }

  // ── Business Operations ─────────────────────────
  processBusinessDay() {
    this.state.businesses.forEach(biz => {
      const data = GAME_DATA.businesses.find(b => b.id === biz.businessId);
      if (!data) return;
      
      const neighborhood = GAME_DATA.neighborhoods.find(n => n.id === biz.neighborhood);
      const demandMod = neighborhood ? neighborhood.demandModifier[data.category] || 1 : 1;
      const trafficMod = neighborhood ? neighborhood.footTraffic : 1;
      
      // Calculate revenue
      let traffic = data.baseCustomerTraffic * trafficMod * demandMod;
      let quality = data.baseQuality + (biz.upgradeLevel || 0) * 0.1;
      let averageSaleValue = data.averageSaleValue;
      let reputationMod = 1 + (this.state.reputation / 100);
      
      // Apply active effects
      this.state.activeEffects.forEach(eff => {
        if (eff.customerTrafficMultiplier) traffic *= eff.customerTrafficMultiplier;
        if (eff.saleValueMultiplier) averageSaleValue *= eff.saleValueMultiplier;
        if (eff.qualityBonus) quality += eff.qualityBonus;
      });
      
      // Employee bonus
      const assignedEmployees = this.state.employees.filter(e => e.assignedBusinessId === biz.instanceId);
      const employeeSkillBonus = assignedEmployees.reduce((sum, e) => sum + (e.skill || 0) * 0.02, 0);
      quality += employeeSkillBonus;
      
      // Player upgrades
      if (this.state.playerUpgrades.includes('upg_marketing')) {
        traffic *= 1.1;
      }
      
      // Randomness (controlled)
      const randomFactor = 0.85 + this.seededRandom() * 0.3; // 0.85-1.15
      
      // Calculate
      const actualTraffic = Math.floor(traffic * randomFactor);
      const customers = Math.min(actualTraffic, data.capacity + (biz.capacityBonus || 0));
      const revenue = Math.floor(customers * data.conversionRate * averageSaleValue * quality * reputationMod);
      
      // Supply cost
      let supplyCost = data.supplyCostPerDay;
      this.state.activeEffects.forEach(eff => {
        if (eff.supplyCostMultiplier) supplyCost *= eff.supplyCostMultiplier;
        if (eff.supplyCostFlat) supplyCost += eff.supplyCostFlat;
      });
      
      // Expenses
      const rent = Math.ceil(data.dailyRent * (biz.rentMultiplier || 1));
      const wages = assignedEmployees.reduce((sum, e) => sum + (e.wage || 0), 0);
      const totalExpenses = Math.floor(supplyCost + rent + wages);
      
      const profit = revenue - totalExpenses;
      
      // Apply to state
      this.state.cash += profit;
      this.state.totalEarned += Math.max(0, revenue);
      this.state.totalSpent += totalExpenses;
      
      // Track results
      biz.lastDayRevenue = revenue;
      biz.lastDayExpenses = totalExpenses;
      biz.lastDayProfit = profit;
      biz.totalProfit = (biz.totalProfit || 0) + profit;
      biz.daysOperated = (biz.daysOperated || 0) + 1;
      
      // Reputation from business
      if (profit > 0) {
        this.changeReputation(Math.max(1, Math.floor(profit / 20)));
      }
    });
  }

  processLoansDay() {
    this.state.loans = this.state.loans.filter(loan => {
      loan.daysRemaining--;
      const fallbackBalance = Math.ceil(loan.totalRepayment * ((loan.daysRemaining + 1) / loan.termDays));
      const currentBalance = loan.remainingBalance ?? fallbackBalance;
      const payment = Math.min(loan.dailyPayment || Math.ceil(loan.totalRepayment / loan.termDays), currentBalance);
      loan.remainingBalance = Math.max(0, currentBalance - payment);
      this.state.cash -= payment;
      this.state.totalSpent += payment;
      
      if (loan.daysRemaining <= 0 || loan.remainingBalance <= 0) {
        this.addNews(`Loan fully repaid: ${loan.name}.`);
        return false;
      }
      return true;
    });
  }

  processEmployeeWages() {
    // Wages are already deducted in processBusinessDay for assigned employees
    // Handle unassigned employees
    this.state.employees.filter(e => !e.assignedBusinessId).forEach(e => {
      this.state.cash -= e.wage;
      this.state.totalSpent += e.wage;
    });
  }

  processEmployeeMorale() {
    this.state.employees.forEach(emp => {
      // Natural morale drift toward 5
      if (emp.morale > 5) emp.morale -= 0.1;
      if (emp.morale < 5) emp.morale += 0.1;
      
      // Loyalty affected by relationship
      const charId = emp.characterId;
      if (charId && this.state.characterTrust[charId] !== undefined) {
        if (this.state.characterTrust[charId] < 0) {
          emp.loyalty -= 0.2;
        }
      }
      
      // Clamp values
      emp.morale = Math.max(0, Math.min(10, emp.morale));
      emp.loyalty = Math.max(0, Math.min(10, emp.loyalty));
      
      // Check if employee leaves
      if (emp.loyalty <= 0 || emp.morale <= 0) {
        this.addNews(`${emp.name} has resigned from your business.`);
        this.addCityMemory(`Employee ${emp.name} resigned.`);
        // Remove from employees
        const idx = this.state.employees.indexOf(emp);
        if (idx >= 0) this.state.employees.splice(idx, 1);
      }
    });
  }

  // ── Rival Actions ───────────────────────────────
  processRivalActions() {
    GAME_DATA.rivalOrganizations.forEach(rival => {
      const relationship = this.state.rivalRelationships[rival.id] || 0;
      const attitude = this.getRivalAttitude(rival.id);
      
      // Rivals take actions based on their personality and relationship
      if (attitude === 'hostile' && this.state.businesses.length > 0 && this.seededRandom() < 0.3) {
        const action = rival.possibleActions.find(a => 
          a.action === 'price_war' || a.action === 'negative_publicity' || a.action === 'open_competing_store'
        );
        if (action) {
          this.executeRivalAction(rival, action);
        }
      } else if (attitude === 'friendly' && this.seededRandom() < 0.15) {
        const action = rival.possibleActions.find(a => 
          a.action === 'offer_supplier_deal' || a.action === 'offer_alliance' || a.action === 'community_event'
        );
        if (action) {
          this.executeRivalAction(rival, action);
        }
      }
    });
  }

  getRivalAttitude(rivalId) {
    const relationship = this.state.rivalRelationships[rivalId] || 0;
    if (relationship >= 30) return 'friendly';
    if (relationship <= -15) return 'hostile';
    return 'neutral';
  }

  executeRivalAction(rival, action) {
    switch (action.action) {
      case 'price_war':
        this.state.activeEffects.push({
          name: `${rival.name} Price War`,
          saleValueMultiplier: 0.85,
          daysRemaining: 3
        });
        this.addNews(`${rival.name} has started a price war in your area.`);
        this.addCityMemory(`${rival.name} initiated a price war.`);
        break;
      case 'negative_publicity':
        this.changeReputation(-3);
        this.addNews(`Negative rumors about your business are spreading. Source: ${rival.name}.`);
        break;
      case 'offer_supplier_deal':
        this.state.activeEffects.push({
          name: `${rival.name} Supplier Deal`,
          supplyCostMultiplier: 0.9,
          daysRemaining: 10
        });
        this.addNews(`${rival.name} offers you a supplier discount.`);
        break;
      case 'community_event':
        this.changeReputation(3);
        this.addNews(`${rival.name} sponsors a community event. Positive vibes all around.`);
        break;
      case 'offer_alliance':
        this.addNews(`${rival.name} expresses interest in an alliance.`);
        break;
      default:
        this.addNews(`${rival.name} makes a business move.`);
    }
  }

  // ── Events ───────────────────────────────────────
  checkRandomEvents() {
    // Only queue one event per day so unseen events are not marked as completed.
    for (const evt of GAME_DATA.events) {
      // Check cooldown
      const lastTriggered = this.state.eventHistory[evt.id] || -999;
      if (evt.canRepeat && (this.state.day - lastTriggered) < (evt.repeatCooldown || 0)) continue;
      if (!evt.canRepeat && lastTriggered >= 0) continue;
      
      // Check trigger conditions
      if (!this.checkCondition(evt.triggerCondition)) continue;
      
      // Roll probability
      if (this.seededRandom() < evt.probability) {
        this.state.eventHistory[evt.id] = this.state.day;
        this.state.pendingEvent = evt;
        break;
      }
    }
  }

  getPendingEvent() {
    return this.state.pendingEvent;
  }

  resolveEvent(evt, choiceIndex) {
    const choice = evt.choices[choiceIndex];
    if (!choice) return { success: false, message: 'Choice not found.' };
    
    // Check condition on choice
    if (choice.condition && !this.checkCondition(choice.condition)) {
      return { success: false, message: 'Requirements not met.' };
    }
    
    const effects = choice.effects;
    if (!effects) return { success: false, message: 'This choice has no effects.' };
    if (effects.energyCost && this.state.energy < effects.energyCost) {
      return { success: false, message: 'Not enough energy.' };
    }
    
    // Apply effects
    Object.entries(effects).forEach(([key, value]) => {
      switch(key) {
        case 'cash': this.state.cash += value; break;
        case 'energyCost': this.state.energy = Math.max(0, this.state.energy - value); break;
        case 'energy': this.state.energy = Math.min(this.state.maxEnergy, this.state.energy + value); break;
        case 'reputation': this.changeReputation(value); break;
        case 'influence': this.state.influence += value; break;
        case 'knowledge': this.state.knowledge += value; break;
        case 'leverage': this.state.leverage += value; break;
        case 'morale': 
          if (this.state.employees.length > 0) {
            this.state.employees.forEach(e => e.morale = Math.max(0, Math.min(10, e.morale + value / this.state.employees.length)));
          }
          break;
        case 'loyalty':
          if (this.state.employees.length > 0) {
            this.state.employees.forEach(e => e.loyalty = Math.max(0, Math.min(10, e.loyalty + value / this.state.employees.length)));
          }
          break;
        case 'supplyCostMultiplier':
          this.state.activeEffects.push({ name: evt.title, supplyCostMultiplier: value, daysRemaining: effects.daysDuration || 3 });
          break;
        case 'saleValueMultiplier':
          this.state.activeEffects.push({ name: evt.title, saleValueMultiplier: value, daysRemaining: effects.daysDuration || 3 });
          break;
        case 'customerTrafficMultiplier':
          this.state.activeEffects.push({ name: evt.title, customerTrafficMultiplier: value, daysRemaining: effects.daysDuration || 3 });
          break;
        case 'qualityBonus':
          this.state.activeEffects.push({ name: evt.title, qualityBonus: value, daysRemaining: effects.daysDuration || 3 });
          break;
        case 'supplyCost':
          this.state.activeEffects.push({ name: evt.title, supplyCostFlat: value, daysRemaining: effects.daysDuration || 3 });
          break;
        case 'dailyRentMultiplier':
          this.state.businesses.forEach(b => b.rentMultiplier = (b.rentMultiplier || 1) * value);
          break;
        case 'relationship':
          if (evt.relatedCharacters && evt.relatedCharacters.length > 0) {
            evt.relatedCharacters.forEach(cId => {
              this.changeRelationship(cId, value);
            });
          }
          break;
        case 'trust':
          if (evt.relatedCharacters && evt.relatedCharacters.length > 0) {
            evt.relatedCharacters.forEach(cId => {
              this.changeTrust(cId, value);
            });
          }
          break;
        case 'clue':
          if (value && !this.state.discoveredClues.includes(value)) {
            this.state.discoveredClues.push(value);
            this.addNews(`New clue discovered: ${this.getClueTitle(value)}`);
          }
          break;
        case 'reliability':
          this.state.employees.forEach(e => e.reliability = Math.max(0, Math.min(10, (e.reliability || 0) + value)));
          break;
        case 'seniorMorale':
          if (this.state.employees[0]) this.state.employees[0].morale = Math.max(0, Math.min(10, this.state.employees[0].morale + value));
          break;
        case 'juniorMorale': {
          const junior = this.state.employees[this.state.employees.length - 1];
          if (junior) junior.morale = Math.max(0, Math.min(10, junior.morale + value));
          break;
        }
        case 'skill': {
          const employee = this.state.employees[0];
          if (employee) employee.skill = Math.max(0, Math.min(10, (employee.skill || 0) + value));
          break;
        }
        case 'wageIncrease': {
          const employee = this.state.employees[0];
          if (employee) employee.wage += value;
          break;
        }
        case 'leaveChance': {
          const employee = [...this.state.employees].sort((a, b) => (a.loyalty || 0) - (b.loyalty || 0))[0];
          if (employee && this.seededRandom() < value) {
            this.state.employees = this.state.employees.filter(e => e.instanceId !== employee.instanceId);
            this.addNews(`${employee.name} accepted another offer and left.`);
          }
          break;
        }
        case 'rivalRelationship': {
          const relatedLeaders = evt.relatedCharacters || [];
          GAME_DATA.rivalOrganizations
            .filter(r => relatedLeaders.length === 0 || relatedLeaders.includes(r.leaderId))
            .forEach(r => this.state.rivalRelationships[r.id] = (this.state.rivalRelationships[r.id] || 0) + value);
          break;
        }
        case 'rivalAlliance': {
          if (!value) break;
          const relatedLeaders = evt.relatedCharacters || [];
          GAME_DATA.rivalOrganizations
            .filter(r => relatedLeaders.length === 0 || relatedLeaders.includes(r.leaderId))
            .forEach(r => {
              if (!this.state.rivalAlliances.includes(r.id)) this.state.rivalAlliances.push(r.id);
            });
          break;
        }
        case 'propertyDiscount':
          this.state.propertyDiscount = Math.max(this.state.propertyDiscount || 0, value);
          break;
        case 'property': {
          if (value !== 'random') break;
          const available = GAME_DATA.properties.filter(p =>
            p.available && !this.state.properties.some(owned => owned.propertyId === p.id)
          );
          if (available.length > 0) {
            const prop = available[this.seededRandomInt(0, available.length - 1)];
            this.state.properties.push({ propertyId: prop.id, purchased: this.state.day, price: Math.abs(effects.cash || 0) });
            this.state.propertiesBought++;
            this.addNews(`Acquired ${prop.name} through an urgent sale.`);
          }
          break;
        }
        case 'daysDuration':
          break;
      }
    });
    
    if (evt.cityMemoryEntry) {
      this.addCityMemory(evt.cityMemoryEntry);
    }
    
    this.state.pendingEvent = null;
    this.triggerTutorial('first_consequential_choice');
    return { success: true, message: choice.text };
  }

  // ── Player Actions ──────────────────────────────
  spendEnergy(amount) {
    if (this.state.energy < amount) return false;
    this.state.energy -= amount;
    return true;
  }

  doTempJob(jobId) {
    const job = GAME_DATA.tempJobs.find(j => j.id === jobId);
    if (!job) return { success: false, message: "Job not found." };
    if (!job.timeSlots.includes(this.state.timeSlot)) return { success: false, message: "Not available at this time." };
    if (!this.spendEnergy(job.energyCost)) return { success: false, message: "Not enough energy." };
    
    const pay = job.pay + this.seededRandomInt(-2, 3);
    this.state.cash += pay;
    this.state.totalEarned += pay;
    this.changeReputation(1);
    
    this.advanceTime();
    this.triggerTutorial('first_earning');
    
    return { success: true, message: `Earned €${pay} as ${job.name}.`, amount: pay };
  }

  openBusiness(businessId, neighborhood) {
    const data = GAME_DATA.businesses.find(b => b.id === businessId);
    if (!data) return { success: false, message: "Business type not found." };
    
    // Check requirements
    if (!this.state.devUnlockBusinesses && this.state.reputation < (data.requirements.reputation || 0)) {
      return { success: false, message: `Need ${data.requirements.reputation} reputation to open this business.` };
    }
    if (this.state.cash < data.startupCost) {
      return { success: false, message: `Need €${data.startupCost} to start this business.` };
    }
    
    // Check if neighborhood is unlocked
    const hood = GAME_DATA.neighborhoods.find(n => n.id === neighborhood);
    if (!this.state.devUnlockBusinesses && hood && this.state.reputation < hood.unlockReputation) {
      return { success: false, message: `Need ${hood.unlockReputation} reputation to operate in ${hood.name}.` };
    }
    
    this.state.cash -= data.startupCost;
    this.state.totalSpent += data.startupCost;
    
    const instance = {
      instanceId: `biz_${Date.now()}_${this.seededRandomInt(0, 999)}`,
      businessId: businessId,
      neighborhood: neighborhood,
      upgradeLevel: 0,
      capacityBonus: 0,
      daysOperated: 0,
      totalProfit: 0,
      lastDayRevenue: 0,
      lastDayExpenses: 0,
      lastDayProfit: 0,
      employees: []
    };
    
    this.state.businesses.push(instance);
    this.state.businessesOpened++;
    this.changeReputation(data.baseReputation);
    
    const hoodName = hood ? hood.name : neighborhood;
    this.addNews(`Opened ${data.name} in ${hoodName}!`);
    this.addCityMemory(`Opened ${data.name} in ${hoodName}.`);
    
    // Rival reactions
    GAME_DATA.rivalOrganizations.forEach(rival => {
      if (rival.preferredNeighborhoods.includes(neighborhood) && 
          rival.businessInterests.includes(data.category)) {
        this.state.rivalRelationships[rival.id] = (this.state.rivalRelationships[rival.id] || 0) - 3;
      }
    });
    
    this.triggerTutorial('first_business');
    
    return { success: true, message: `Opened ${data.name} in ${hoodName}!`, instance };
  }

  upgradeBusiness(instanceId) {
    const biz = this.state.businesses.find(b => b.instanceId === instanceId);
    if (!biz) return { success: false, message: "Business not found." };
    
    const data = GAME_DATA.businesses.find(b => b.id === biz.businessId);
    if (!data) return { success: false, message: "Business data not found." };
    
    const nextLevel = biz.upgradeLevel + 1;
    if (nextLevel > data.upgradeLevels) return { success: false, message: "Already at max level." };
    
    const cost = data.upgradeCosts[nextLevel - 1];
    if (this.state.cash < cost) return { success: false, message: `Need €${cost} for this upgrade.` };
    
    const upgrade = GAME_DATA.upgrades.find(u => 
      u.businessId === biz.businessId && u.level === nextLevel
    );
    
    this.state.cash -= cost;
    this.state.totalSpent += cost;
    biz.upgradeLevel = nextLevel;
    
    if (upgrade) {
      biz.capacityBonus = (biz.capacityBonus || 0) + (upgrade.capacityBonus || 0);
    }
    
    this.addNews(`Upgraded ${data.name} to level ${nextLevel}!`);
    this.addCityMemory(`Upgraded ${data.name}.`);
    
    return { success: true, message: `Upgraded to level ${nextLevel}: ${upgrade ? upgrade.name : 'Improved'}` };
  }

  closeBusiness(instanceId) {
    const idx = this.state.businesses.findIndex(b => b.instanceId === instanceId);
    if (idx < 0) return { success: false, message: "Business not found." };
    
    const biz = this.state.businesses[idx];
    const data = GAME_DATA.businesses.find(b => b.id === biz.businessId);
    
    // Unassign employees
    this.state.employees.filter(e => e.assignedBusinessId === instanceId).forEach(e => {
      e.assignedBusinessId = null;
    });
    
    // Sell value (partial refund)
    const sellValue = Math.floor(data.startupCost * 0.3);
    this.state.cash += sellValue;
    
    this.state.businesses.splice(idx, 1);
    this.changeReputation(-3);
    
    this.addNews(`Closed ${data.name}. Received €${sellValue} from asset sale.`);
    this.addCityMemory(`Closed ${data.name}.`);
    
    return { success: true, message: `Closed business. Received €${sellValue}.` };
  }

  // ── Employees ───────────────────────────────────
  hireEmployee(candidateId) {
    const candidate = GAME_DATA.employeeCandidates.find(c => c.id === candidateId);
    if (!candidate) return { success: false, message: "Candidate not found." };
    
    if (this.state.employees.find(e => e.candidateId === candidateId)) {
      return { success: false, message: "Already hired." };
    }
    
    const employee = {
      ...candidate,
      candidateId: candidateId,
      instanceId: `emp_${Date.now()}_${this.seededRandomInt(0, 999)}`,
      assignedBusinessId: null,
      daysWorked: 0,
      hired: true
    };
    
    this.state.employees.push(employee);
    this.state.employeesHired++;
    
    // Update character relationship if linked
    if (candidate.characterId) {
      this.changeRelationship(candidate.characterId, 15);
      this.changeTrust(candidate.characterId, 10);
    }
    
    this.changeReputation(2);
    this.addNews(`Hired ${candidate.name} as a new employee.`);
    this.addCityMemory(`Hired ${candidate.name}.`);
    
    this.triggerTutorial('first_employee');
    
    return { success: true, message: `Hired ${candidate.name}!`, employee };
  }

  assignEmployee(employeeInstanceId, businessInstanceId) {
    const emp = this.state.employees.find(e => e.instanceId === employeeInstanceId);
    if (!emp) return { success: false, message: "Employee not found." };
    
    if (businessInstanceId) {
      const biz = this.state.businesses.find(b => b.instanceId === businessInstanceId);
      if (!biz) return { success: false, message: "Business not found." };
      
      const data = GAME_DATA.businesses.find(b => b.id === biz.businessId);
      const currentAssigned = this.state.employees.filter(e => e.assignedBusinessId === businessInstanceId).length;
      if (currentAssigned >= data.employeeSlots) {
        return { success: false, message: "No open slots at this business." };
      }
    }
    
    emp.assignedBusinessId = businessInstanceId || null;
    return { success: true, message: businessInstanceId ? `Assigned ${emp.name} to business.` : `Unassigned ${emp.name}.` };
  }

  adjustEmployeeWage(employeeInstanceId, newWage) {
    const emp = this.state.employees.find(e => e.instanceId === employeeInstanceId);
    if (!emp) return { success: false, message: "Employee not found." };
    
    const oldWage = emp.wage;
    emp.wage = newWage;
    
    if (newWage > oldWage) {
      emp.morale = Math.min(10, emp.morale + 1);
      emp.loyalty = Math.min(10, emp.loyalty + 1);
    } else if (newWage < oldWage) {
      emp.morale = Math.max(0, emp.morale - 2);
      emp.loyalty = Math.max(0, emp.loyalty - 2);
    }
    
    return { success: true, message: `${emp.name}'s wage set to €${newWage}/day.` };
  }

  dismissEmployee(employeeInstanceId) {
    const idx = this.state.employees.findIndex(e => e.instanceId === employeeInstanceId);
    if (idx < 0) return { success: false, message: "Employee not found." };
    
    const emp = this.state.employees[idx];
    this.state.employees.splice(idx, 1);
    
    this.changeReputation(-3);
    if (emp.characterId) {
      this.changeRelationship(emp.characterId, -20);
      this.changeTrust(emp.characterId, -15);
    }
    
    this.addNews(`${emp.name} has been dismissed.`);
    this.addCityMemory(`Dismissed employee ${emp.name}.`);
    
    return { success: true, message: `${emp.name} has been dismissed.` };
  }

  // ── Conversations ────────────────────────────────
  talkToCharacter(characterId) {
    const char = GAME_DATA.characters.find(c => c.id === characterId);
    if (!char) return { success: false, message: "Character not found." };
    
    const relationship = this.state.characterRelationships[characterId] || 0;
    const trust = this.state.characterTrust[characterId] || 0;
    
    // Determine dialogue state
    let state = 'introduction';
    if (relationship > 20) state = 'friendly';
    else if (relationship < -10) state = 'suspicious';
    else if (relationship < -20) state = 'upset';
    
    // Check for special states
    if (this.state.discoveredClues.length >= 3 && characterId === 'dimitri_sokol') {
      state = 'suspicious';
    }
    if (trust >= 15 && (characterId === 'alexei_volkov' || characterId === 'karim_osman')) {
      state = 'friendly';
    }
    
    this.state.characterDialogueState[characterId] = state;
    
    // Dialogue result
    let dialogue = char.dialogueStates[state] || char.dialogueStates.introduction;
    let bonusText = '';
    let clues = [];
    let actions = [];
    
    // Relationship-based bonuses
    if (relationship >= 15) {
      this.changeTrust(characterId, 2);
    }
    
    // Mystery clues based on character and trust
    if (char.dialogueStates.mystery_hint && trust >= (this.getMysteryHintTrust(characterId) || 10)) {
      bonusText = char.dialogueStates.mystery_hint;
      // Discover related clues
      const relatedClues = GAME_DATA.mysteryClues.filter(c => 
        c.source === characterId || 
        (c.discoveryMethod && c.discoveryMethod.includes(characterId))
      );
      relatedClues.forEach(c => {
        if (!this.state.discoveredClues.includes(c.id) && trust >= (c.requiredTrust || 0)) {
          clues.push(c.id);
          this.state.discoveredClues.push(c.id);
        }
      });
    }
    
    // Available actions based on character role
    if (characterId === 'james_chen') actions.push('request_loan');
    if (characterId === 'elena_kosta') actions.push('view_properties');
    if (characterId === 'nora_petrov' && this.state.discoveredClues.length >= 2) actions.push('investigate_together');
    if (characterId === 'dimitri_sokol' && this.state.discoveredClues.length >= 5) actions.push('confront');
    
    this.changeRelationship(characterId, 3);
    
    this.advanceTime();
    this.triggerTutorial('first_conversation');
    
    return {
      success: true,
      characterId,
      dialogue,
      bonusText,
      clues,
      actions,
      relationship: this.state.characterRelationships[characterId],
      trust: this.state.characterTrust[characterId],
      state
    };
  }

  getMysteryHintTrust(characterId) {
    const trustMap = {
      'maria_voss': 10,
      'elena_kosta': 20,
      'ivan_kovac': 10,
      'nora_petrov': 5,
      'karim_osman': 10,
      'james_chen': 15,
      'clara_dumont': 20,
      'dimitri_sokol': 0,
      'svetlana_markov': 0,
      'tom_brady': 5,
      'lisette_valenti': 15,
      'dimitri_sokol_jr': 15
    };
    return trustMap[characterId] || 10;
  }

  // ── Investigation ────────────────────────────────
  investigateAtLocation(locationId) {
    if (this.state.energy < 2) return { success: false, message: "Need 2 energy to investigate." };
    this.spendEnergy(2);
    this.state.knowledge += 1;
    
    // Find clues discoverable at this location
    const discoverable = GAME_DATA.mysteryClues.filter(c => {
      if (this.state.discoveredClues.includes(c.id)) return false;
      if (c.location !== locationId && c.discoveryMethod !== 'visit_riverside') return false;
      if (c.requiredTrust && c.requiredTrust > 0) return false; // Need character trust
      if (c.requiredInfluence && this.state.influence < c.requiredInfluence) return false;
      if (c.requiredKnowledge && this.state.knowledge < c.requiredKnowledge) return false;
      return true;
    });
    
    let discovered = [];
    if (discoverable.length > 0 && this.seededRandom() < 0.6) {
      const clue = discoverable[Math.floor(this.seededRandom() * discoverable.length)];
      this.state.discoveredClues.push(clue.id);
      discovered.push(clue.id);
      this.addNews(`Investigation reveals: "${clue.title}"`);
    }
    
    this.advanceTime();
    
    return {
      success: true,
      discovered,
      knowledge: this.state.knowledge,
      message: discovered.length > 0 
        ? `You found a clue: "${this.getClueTitle(discovered[0])}"` 
        : "Your investigation didn't turn up anything new this time."
    };
  }

  investigateRecords() {
    if (this.state.energy < 2) return { success: false, message: "Need 2 energy." };
    this.spendEnergy(2);
    this.state.knowledge += 1;
    
    const discoverable = GAME_DATA.mysteryClues.filter(c => {
      if (this.state.discoveredClues.includes(c.id)) return false;
      if (c.discoveryMethod !== 'investigate_records' && c.discoveryMethod !== 'deep_investigation') return false;
      if (c.requiredInfluence && this.state.influence < c.requiredInfluence) return false;
      if (c.requiredKnowledge && this.state.knowledge < c.requiredKnowledge) return false;
      return true;
    });
    
    let discovered = [];
    if (discoverable.length > 0) {
      const clue = discoverable[0];
      this.state.discoveredClues.push(clue.id);
      discovered.push(clue.id);
      this.addNews(`Public records reveal: "${clue.title}"`);
    }
    
    this.changeInfluence(1);
    this.advanceTime();
    
    return {
      success: true,
      discovered,
      message: discovered.length > 0 
        ? `Records check reveals: "${this.getClueTitle(discovered[0])}"` 
        : "Nothing new in the records right now."
    };
  }

  // ── Mystery Resolution ───────────────────────────
  checkMysteryResolutions() {
    return GAME_DATA.mysteryResolutions.filter(res => {
      return res.requiredClues.every(c => this.state.discoveredClues.includes(c));
    });
  }

  resolveMystery(resolutionId) {
    const resolution = GAME_DATA.mysteryResolutions.find(r => r.id === resolutionId);
    if (!resolution) return { success: false, message: "Resolution not found." };
    
    // Check all required clues
    if (!resolution.requiredClues.every(c => this.state.discoveredClues.includes(c))) {
      return { success: false, message: "You don't have enough evidence for this resolution." };
    }
    
    this.state.mysteryResolved = true;
    this.state.mysteryResolution = resolutionId;
    
    const cons = resolution.consequences;
    
    // Apply consequences
    this.changeReputation(cons.reputation || 0);
    this.state.influence += cons.influence || 0;
    if (cons.cash) this.state.cash += cons.cash;
    
    // Apply relationship changes
    Object.entries(cons).forEach(([key, value]) => {
      if (key.endsWith('_relationship') && typeof value === 'number') {
        const charId = key.replace('_relationship', '');
        this.changeRelationship(charId, value);
      }
    });
    
    // Unlock harbor tower
    const tower = GAME_DATA.locations.find(l => l.id === 'locked_tower');
    if (tower) {
      tower.locked = false;
      tower.actions = ['enter'];
      tower.availableTimeSlots = [0, 1, 2];
    }
    
    // Add narrative summary to news
    this.addNews(`MYSTERY RESOLVED: ${resolution.name}`);
    this.addNews(cons.narrativeSummary);
    this.addCityMemory(`Mystery resolved: ${resolution.name}`);
    
    return {
      success: true,
      message: cons.narrativeSummary,
      consequences: cons
    };
  }

  // ── Loans ────────────────────────────────────────
  requestLoan(loanId) {
    const offer = GAME_DATA.loanOffers.find(l => l.id === loanId);
    if (!offer) return { success: false, message: "Loan not found." };
    
    if (this.state.reputation < offer.minReputation) {
      return { success: false, message: `Need ${offer.minReputation} reputation for this loan.` };
    }
    
    const jamesRel = this.state.characterRelationships['james_chen'] || 0;
    if (jamesRel < offer.minRelationship) {
      return { success: false, message: `Need better relationship with James Chen.` };
    }
    
    // Check if already have active loan
    if (this.state.loans.length > 0) {
      return { success: false, message: "You already have an active loan. Repay it first." };
    }
    
    const totalRepayment = Math.ceil(offer.amount * (1 + offer.interestRate));
    const dailyPayment = Math.ceil(totalRepayment / offer.termDays);
    
    this.state.loans.push({
      id: `loan_${Date.now()}`,
      loanId: loanId,
      name: offer.name,
      amount: offer.amount,
      totalRepayment: totalRepayment,
      remainingBalance: totalRepayment,
      dailyPayment: dailyPayment,
      termDays: offer.termDays,
      daysRemaining: offer.termDays
    });
    
    this.state.cash += offer.amount;
    this.changeRelationship('james_chen', 5);
    
    this.addNews(`Received ${offer.name}: €${offer.amount}. Daily repayment: €${dailyPayment}.`);
    this.addCityMemory(`Took out ${offer.name}.`);
    
    return { success: true, message: `Loan approved: €${offer.amount}. Daily repayment: €${dailyPayment}.` };
  }

  repayLoanEarly() {
    if (this.state.loans.length === 0) return { success: false, message: "No active loans." };
    
    const loan = this.state.loans[0];
    const remaining = loan.remainingBalance ?? Math.ceil(loan.totalRepayment * (loan.daysRemaining / loan.termDays));
    
    if (this.state.cash < remaining) {
      return { success: false, message: `Need €${remaining} to repay early.` };
    }
    
    this.state.cash -= remaining;
    this.state.totalSpent += remaining;
    this.state.loans = [];
    this.changeReputation(5);
    this.changeRelationship('james_chen', 10);
    
    this.addNews(`Loan repaid early!`);
    return { success: true, message: `Repaid €${remaining}. Loan cleared!` };
  }

  // ── Properties ──────────────────────────────────
  buyProperty(propertyId) {
    const prop = GAME_DATA.properties.find(p => p.id === propertyId);
    if (!prop) return { success: false, message: "Property not found." };
    
    if (!prop.available) return { success: false, message: "This property is not available." };
    if (prop.unlockCondition && !this.checkCondition(prop.unlockCondition)) {
      return { success: false, message: "This property is not available yet." };
    }
    const price = Math.max(0, prop.price - (this.state.propertyDiscount || 0));
    if (this.state.cash < price) {
      return { success: false, message: `Need €${price} to buy this property.` };
    }
    
    this.state.cash -= price;
    this.state.totalSpent += price;
    this.state.properties.push({
      propertyId: propertyId,
      purchased: this.state.day,
      price
    });
    this.state.propertyDiscount = 0;
    this.state.propertiesBought++;
    
    this.changeReputation(5);
    this.changeInfluence(3);
    
    this.addNews(`Purchased ${prop.name} for €${price}!`);
    this.addCityMemory(`Bought property: ${prop.name}.`);
    
    return { success: true, message: `Purchased ${prop.name} for €${price}!` };
  }

  // ── Goods Trading ───────────────────────────────
  buyGoods(goodId, quantity) {
    const good = GAME_DATA.goods.find(g => g.id === goodId);
    if (!good) return { success: false, message: "Good not found." };
    
    const cost = good.buyPrice * quantity;
    if (this.state.cash < cost) return { success: false, message: `Need €${cost}.` };
    if (!this.spendEnergy(1)) return { success: false, message: "Not enough energy." };
    
    this.state.cash -= cost;
    this.state.totalSpent += cost;
    
    // Add to inventory
    const existing = this.state.inventory.find(i => i.goodId === goodId);
    if (existing) {
      existing.quantity += quantity;
    } else {
      this.state.inventory.push({ goodId, quantity, buyPrice: good.buyPrice });
    }
    
    return { success: true, message: `Bought ${quantity}x ${good.name} for €${cost}.` };
  }

  sellGoods(goodId, quantity) {
    const good = GAME_DATA.goods.find(g => g.id === goodId);
    if (!good) return { success: false, message: "Good not found." };
    
    const inv = this.state.inventory.find(i => i.goodId === goodId);
    if (!inv || inv.quantity < quantity) return { success: false, message: "Not enough inventory." };
    if (!this.spendEnergy(1)) return { success: false, message: "Not enough energy." };
    
    const revenue = good.sellPrice * quantity;
    const randomBonus = this.seededRandomInt(-1, 3);
    const total = revenue + randomBonus;
    
    this.state.cash += total;
    this.state.totalEarned += total;
    inv.quantity -= quantity;
    
    if (inv.quantity <= 0) {
      this.state.inventory = this.state.inventory.filter(i => i.goodId !== goodId);
    }
    
    this.changeReputation(1);
    this.advanceTime();
    this.triggerTutorial('first_earning');
    
    return { success: true, message: `Sold ${quantity}x ${good.name} for €${total}.` };
  }

  // ── Negotiation ─────────────────────────────────
  negotiate(characterId, offerType, offerValue) {
    const char = GAME_DATA.characters.find(c => c.id === characterId);
    if (!char) return { success: false, message: "Character not found." };
    
    const relationship = this.state.characterRelationships[characterId] || 0;
    const trust = this.state.characterTrust[characterId] || 0;
    
    // Base acceptance = relationship + trust/2 + negotiation upgrade + leverage
    let acceptance = relationship + (trust / 2) + (this.state.leverage * 3);
    if (this.state.playerUpgrades.includes('upg_negotiation')) acceptance += 5;
    
    // Add some randomness
    acceptance += this.seededRandomInt(-5, 5);
    
    // Threshold
    const threshold = 20; // Need 20+ to succeed
    const success = acceptance >= threshold;
    
    if (success) {
      this.changeRelationship(characterId, 5);
      this.changeTrust(characterId, 3);
      this.state.leverage = Math.max(0, this.state.leverage - 1);
    } else {
      this.changeRelationship(characterId, -3);
      this.changeTrust(characterId, -2);
    }
    
    this.advanceTime();
    
    return {
      success,
      message: success 
        ? `${char.name} accepts your offer. The deal is done.` 
        : `${char.name} isn't interested. Maybe try a different approach.`,
      acceptance,
      threshold
    };
  }

  // ── Rest ────────────────────────────────────────
  rest() {
    this.state.energy = Math.min(this.state.maxEnergy, this.state.energy + 3);
    this.advanceTime();
    return { success: true, message: "You rest and recover some energy." };
  }

  // ── Resource Changes ────────────────────────────
  changeReputation(amount) {
    let bonus = 1;
    if (this.state.playerUpgrades.includes('upg_reputation')) bonus = 1.15;
    this.state.reputation += Math.floor(amount * bonus);
    this.state.reputation = Math.max(-50, Math.min(100, this.state.reputation));
  }

  changeRelationship(characterId, amount) {
    this.state.characterRelationships[characterId] = 
      (this.state.characterRelationships[characterId] || 0) + amount;
    this.state.characterRelationships[characterId] = 
      Math.max(-100, Math.min(100, this.state.characterRelationships[characterId]));
  }

  changeTrust(characterId, amount) {
    this.state.characterTrust[characterId] = 
      (this.state.characterTrust[characterId] || 0) + amount;
    this.state.characterTrust[characterId] = 
      Math.max(-100, Math.min(100, this.state.characterTrust[characterId]));
  }

  changeInfluence(amount) {
    this.state.influence = Math.max(0, Math.min(100, this.state.influence + amount));
  }

  // ── Utility Methods ──────────────────────────────
  addNews(text) {
    this.state.newsFeed.unshift({
      text,
      day: this.state.day,
      time: GAME_DATA.timeSlotNames[this.state.timeSlot],
      timestamp: Date.now()
    });
    // Keep last 50
    if (this.state.newsFeed.length > 50) this.state.newsFeed.pop();
  }

  addCityMemory(text) {
    this.state.cityMemory.push({
      text,
      day: this.state.day
    });
  }

  getClueTitle(clueId) {
    const clue = GAME_DATA.mysteryClues.find(c => c.id === clueId);
    return clue ? clue.title : clueId;
  }

  checkCondition(condition) {
    if (!condition) return true;
    if (condition === 'true') return true;
    if (condition === 'has_business') return this.state.businesses.length > 0;
    if (condition === 'has_business_in_riverside') return this.state.businesses.some(b => b.neighborhood === 'riverside');
    if (condition === 'has_business_with_rent') return this.state.businesses.length > 0;
    if (condition === 'employee_count >= 1') return this.state.employees.length >= 1;
    if (condition === 'employee_count >= 2') return this.state.employees.length >= 2;
    if (condition === 'rival_neutral_or_friendly') return GAME_DATA.rivalOrganizations.some(r => this.getRivalAttitude(r.id) !== 'hostile');
    if (condition === 'any_relationship >= 15') return Object.values(this.state.characterRelationships).some(v => v >= 15);
    if (condition === 'any_trust < 20') return Object.values(this.state.characterTrust).some(v => v < 20);
    if (condition === 'has_clue_count >= 3') return this.state.discoveredClues.length >= 3;
    if (condition.startsWith('reputation >= ')) return this.state.reputation >= parseInt(condition.split('>= ')[1]);
    if (condition.startsWith('influence >= ')) return this.state.influence >= parseInt(condition.split('>= ')[1]);
    if (condition.startsWith('energy >= ')) return this.state.energy >= parseInt(condition.split('>= ')[1]);
    if (condition.startsWith('day >= ')) return this.state.day >= parseInt(condition.split('>= ')[1]);
    if (condition === 'mystery_resolved') return this.state.mysteryResolved;
    return false;
  }

  triggerTutorial(trigger) {
    if (this.tutorialFlags[trigger]) return;
    this.tutorialFlags[trigger] = true;
    if (this.state) this.state.tutorialCompleted[trigger] = true;
    
    const step = GAME_DATA.tutorialSteps.find(s => s.trigger === trigger);
    if (step) {
      this.state.currentTutorial = step;
    }
  }

  getTutorial() {
    return this.state.currentTutorial;
  }

  clearTutorial() {
    this.state.currentTutorial = null;
  }

  // ── Daily Summary ────────────────────────────────
  getDailySummary() {
    const totalDailyRevenue = this.state.businesses.reduce((sum, b) => sum + (b.lastDayRevenue || 0), 0);
    const totalDailyExpenses = this.state.businesses.reduce((sum, b) => sum + (b.lastDayExpenses || 0), 0);
    const totalDailyProfit = totalDailyRevenue - totalDailyExpenses;
    const totalDailyWages = this.state.employees.reduce((sum, e) => sum + (e.wage || 0), 0);
    const dailyLoanPayment = this.state.loans.reduce((sum, l) => sum + Math.min(l.dailyPayment, l.remainingBalance ?? l.dailyPayment), 0);
    
    return {
      revenue: totalDailyRevenue,
      expenses: totalDailyExpenses,
      profit: totalDailyProfit,
      wages: totalDailyWages,
      loanPayment: dailyLoanPayment,
      netCash: totalDailyProfit - dailyLoanPayment
    };
  }

  // ── Progression Stage ────────────────────────────
  getProgressionStage() {
    if (this.state.businesses.length === 0) return 1;
    if (this.state.businesses.length >= 1 && this.state.employees.length >= 1) return 2;
    if (this.state.businesses.length >= 2 && this.state.properties.length >= 1) return 3;
    if (this.state.influence >= 20 && this.state.mysteryResolved) return 4;
    return 2;
  }

  // ── Buy Player Upgrade ──────────────────────────
  buyPlayerUpgrade(upgradeId) {
    const upgrade = GAME_DATA.upgrades.find(u => u.id === upgradeId && u.businessId === 'player');
    if (!upgrade) return { success: false, message: "Upgrade not found." };
    if (this.state.playerUpgrades.includes(upgradeId)) return { success: false, message: "Already purchased." };
    if (this.state.cash < upgrade.cost) return { success: false, message: `Need €${upgrade.cost}.` };
    
    this.state.cash -= upgrade.cost;
    this.state.totalSpent += upgrade.cost;
    this.state.playerUpgrades.push(upgradeId);
    
    this.addNews(`Acquired: ${upgrade.name}!`);
    return { success: true, message: `${upgrade.name} acquired! ${upgrade.description || ''}` };
  }

  // ── Dev Tools ────────────────────────────────────
  devAddCash(amount) {
    this.state.cash += amount;
    this.addNews(`[DEV] Added €${amount}.`);
  }

  devAdvanceTime() {
    this.endDay();
  }

  devSetRelationship(characterId, value) {
    this.state.characterRelationships[characterId] = value;
  }

  devTriggerEvent(eventId) {
    const evt = GAME_DATA.events.find(e => e.id === eventId);
    if (evt) this.state.pendingEvent = evt;
  }

  devUnlockAllBusinesses() {
    this.state.devUnlockBusinesses = true;
  }

  devViewCityMemory() {
    return this.state.cityMemory;
  }

  devReset() {
    return this.newGame();
  }
}

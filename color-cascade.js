    // Game configuration
    const COLORS = ['#FF3366', '#FF6633', '#FFCC33', '#33CC66', '#3366FF', '#CC33FF', '#FF33CC', '#33FFCC', '#FF9933', '#9933FF'];

    const POWER_UPS = {
      'bonus': {
        name: 'Score Bonus',
        icon: '💎',
        description: 'Bonus points!',
        activate: function() {
          gameState.score += 50 * gameState.level;
          scoreElement.textContent = gameState.score;
          showPowerUpEffect('💎 BONUS POINTS!');
        }
      },
      'time': {
        name: 'Time Bonus',
        icon: '⏱️',
        description: '+5 seconds',
        activate: function() {
          const levelConfig = calculateLevelConfig(gameState.level);
          gameState.timeLeft = Math.min(levelConfig.time, gameState.timeLeft + 5);
          updateTimerBar();
          showPowerUpEffect('⏱️ +5 SECONDS!');
        }
      },
      'mult': {
        name: 'Score Multiplier',
        icon: '✨',
        description: '2x score for 10s',
        activate: function() {
          gameState.scoreMultiplier = 2;
          showPowerUpEffect('✨ 2X SCORE!');
          setTimeout(() => {
            gameState.scoreMultiplier = 1;
          }, 10000);
        }
      }
    };

    const BASE_LEVEL_CONFIG = {
      timeMultiplier: 0.92,           // Was 0.97 - faster time reduction
      pairMultiplier: 1.25,           // Was 1.15 - more pairs per level
      colorMultiplier: 1.15,          // Was 1.1 - more colors per level
      minTime: 8,                     // Was 10 - lower minimum time
      maxPairs: 36,                   // Was 32 - more maximum pairs
      maxColors: 10,                  // Same
      startTime: 50,                  // Was 60 - less starting time
      startPairs: 8,                  // Same
      startColors: 4                  // Same
    };

    const COMBO_CONFIG = {
      baseTimeout: 4000,              // Was 5000 - less time for combos
      minTimeout: 1500,               // Was 2000 - shorter minimum timeout
      timeoutReductionPerLevel: 0.15, // Was 0.1 - faster reduction per level
      maxComboMultiplier: 5,          // Same
      significantComboThreshold: 3    // Same
    };

    // Function to calculate level configuration with adaptive difficulty
    function calculateLevelConfig(level) {
      // Get player performance metrics for adaptive difficulty
      const profile = PlayerProfile.load();
      const performanceRatio = profile.stats.gamesPlayed > 0 ? 
        profile.stats.avgScore / (profile.stats.avgLevel * 100) : 1;
      
      // Adaptive difficulty factor (0.8 to 1.2)
      // Higher performance ratio = harder game
      const adaptiveFactor = Math.min(1.2, Math.max(0.8, performanceRatio));
      
      // Apply user-selected difficulty settings
      const userDifficultyFactor = gameSettings.difficultyLevel / 3;
      
      // Combine factors
      const difficultyMultiplier = adaptiveFactor * userDifficultyFactor;
      
      // For levels above 20, we apply a more aggressive scaling
      const advancedLevel = Math.max(0, level - 20);
      const advancedFactor = advancedLevel > 0 ? (1 + (advancedLevel / 20)) : 1;
      
      // For levels above 50, we apply even more aggressive scaling
      const expertLevel = Math.max(0, level - 50);
      const expertFactor = expertLevel > 0 ? (1 + (expertLevel / 15)) : 1;
      
      // Calculate pairs based on level with enhanced difficulty for higher levels
      let pairs = Math.min(
        BASE_LEVEL_CONFIG.maxPairs,
        Math.floor(BASE_LEVEL_CONFIG.startPairs * Math.pow(BASE_LEVEL_CONFIG.pairMultiplier, Math.log(level + 1)))
      );
      
      // Apply advanced scaling for pairs
      if (level > 20) {
        pairs = Math.min(BASE_LEVEL_CONFIG.maxPairs, Math.floor(pairs * advancedFactor));
      }
      
      // Calculate number of colors with enhanced difficulty
      let colors = Math.min(
        BASE_LEVEL_CONFIG.maxColors,
        Math.floor(BASE_LEVEL_CONFIG.startColors * Math.pow(BASE_LEVEL_CONFIG.colorMultiplier, Math.log(level + 1)))
      );
      
      // Increase color variety in advanced levels
      if (level > 30) {
        colors = BASE_LEVEL_CONFIG.maxColors; // Always use max colors after level 30
      }
      
      // Calculate time with aggressive reductions for higher levels
      let time = Math.max(
        BASE_LEVEL_CONFIG.minTime,
        Math.floor(BASE_LEVEL_CONFIG.startTime * Math.pow(BASE_LEVEL_CONFIG.timeMultiplier, level - 1))
      );
      
      // Apply expert scaling for time (makes it even harder)
      if (level > 50) {
        time = Math.max(BASE_LEVEL_CONFIG.minTime * 0.75, Math.floor(time / expertFactor));
      }
      
      // Apply adaptive difficulty to time
      time = Math.floor(time / difficultyMultiplier);
      
      // Calculate combo timeout for this level - gets shorter in higher levels
      const comboTimeout = Math.max(
        COMBO_CONFIG.minTimeout,
        COMBO_CONFIG.baseTimeout * Math.pow(1 - COMBO_CONFIG.timeoutReductionPerLevel, level - 1)
      );
      
      // Probability of power-ups decreases in higher levels to make them more challenging
      const powerUpChance = Math.max(0.05, 0.3 - (level * 0.01)); 
      
      console.log(`Level ${level} config:`, { pairs, colors, time, comboTimeout, powerUpChance });
      
      return {
        pairs,
        colors,
        time,
        comboTimeout,
        powerUpChance
      };
    }

    function getComboTimeout(level) {
      return Math.max(
        COMBO_CONFIG.minTimeout,
        Math.floor(COMBO_CONFIG.baseTimeout * Math.pow(1 - COMBO_CONFIG.timeoutReductionPerLevel, level - 1))
      );
    }

    // Player profile and statistics management
    const PlayerProfile = {
      load() {
        const defaultProfile = {
          name: 'Player',
          created: new Date().toISOString(),
          stats: {
            gamesPlayed: 0,
            totalScore: 0,
            highestLevel: 0,
            highestScore: 0,
            totalMatches: 0,
            totalCombos: 0,
            bestCombo: 0,
            totalPlayTime: 0,
            lastPlayed: null,
            avgScore: 0,
            avgLevel: 0
          },
          achievements: [],
          preferences: {
            soundEnabled: true,
            theme: 'default',
            difficulty: 3
          },
          highScores: []
        };
        
        const saved = localStorage.getItem('colorCascadeProfile');
        return saved ? { ...defaultProfile, ...JSON.parse(saved) } : defaultProfile;
      },
      
      save(profile) {
        localStorage.setItem('colorCascadeProfile', JSON.stringify(profile));
      },
      
      updateStats(gameData) {
        const profile = this.load();
        profile.stats.gamesPlayed++;
        profile.stats.totalScore += gameData.score;
        profile.stats.highestLevel = Math.max(profile.stats.highestLevel, gameData.level);
        profile.stats.highestScore = Math.max(profile.stats.highestScore, gameData.score);
        profile.stats.totalMatches += gameData.matches;
        profile.stats.totalCombos += gameData.combosAchieved || 0;
        profile.stats.bestCombo = Math.max(profile.stats.bestCombo, gameData.bestCombo || 0);
        profile.stats.lastPlayed = new Date().toISOString();
        profile.stats.avgScore = Math.floor(profile.stats.totalScore / profile.stats.gamesPlayed);
        profile.stats.avgLevel = Math.floor((profile.stats.avgLevel * (profile.stats.gamesPlayed - 1) + gameData.level) / profile.stats.gamesPlayed);
        
        this.save(profile);
        return profile;
      },
      
      addAchievement(achievement) {
        const profile = this.load();
        if (!profile.achievements.find(a => a.id === achievement.id)) {
          profile.achievements.push({
            ...achievement,
            unlockedAt: new Date().toISOString()
          });
          this.save(profile);
          return true;
        }
        return false;
      }
    };
    
    // Achievement definitions
    const ACHIEVEMENTS = [
      { id: 'first_game', name: 'Welcome!', description: 'Play your first game', icon: '🎮' },
      { id: 'score_1000', name: 'Scorer', description: 'Score 1,000 points', icon: '⭐' },
      { id: 'score_5000', name: 'High Scorer', description: 'Score 5,000 points', icon: '🌟' },
      { id: 'score_10000', name: 'Master Scorer', description: 'Score 10,000 points', icon: '💫' },
      { id: 'level_10', name: 'Climbing', description: 'Reach level 10', icon: '📈' },
      { id: 'level_25', name: 'Ascending', description: 'Reach level 25', icon: '🚀' },
      { id: 'level_50', name: 'Summit', description: 'Reach level 50', icon: '🏔️' },
      { id: 'combo_5', name: 'Combo Starter', description: 'Get a 5x combo', icon: '🔥' },
      { id: 'combo_10', name: 'Combo Master', description: 'Get a 10x combo', icon: '💥' },
      { id: 'perfect_level', name: 'Perfectionist', description: 'Clear a level with 100% matches', icon: '✨' },
      { id: 'speed_demon', name: 'Speed Demon', description: 'Clear a level in under 10 seconds', icon: '⚡' },
      { id: 'endurance', name: 'Endurance', description: 'Play for 30 minutes straight', icon: '⏱️' }
    ];
    
    // Load player profile on start
    let playerProfile = PlayerProfile.load();

    let gameState = {
      level: 1,
      score: 0,
      matches: 0,
      timeLeft: 0,
      selectedTile: null,
      connecting: false,
      gameActive: false,
      tiles: [],
      timerInterval: null,
      scoreMultiplier: 1,
      soundEnabled: playerProfile.preferences.soundEnabled,
      consecutiveMatches: 0,
      comboMultiplier: 1,
      comboChain: [],
      comboConnections: [],
      activeComboColor: null,
      comboTimeoutId: null,
      highScores: playerProfile.highScores || [],
      comboTrails: [],
      // New tracking fields
      gameStartTime: null,
      combosAchieved: 0,
      bestCombo: 0,
      perfectClear: true
    };

    const grid = document.getElementById('game-grid');
    const scoreElement = document.getElementById('score');
    const levelElement = document.getElementById('level');
    const matchesElement = document.getElementById('matches');
    const timerBar = document.getElementById('timer-bar');
    const gameOverModal = document.getElementById('game-over-modal');
    const highScoresModal = document.getElementById('high-scores-modal');
    const finalScoreElement = document.getElementById('final-score');
    const highScoresList = document.getElementById('high-scores-list');
    const comboIndicator = document.getElementById('combo-indicator');

    document.getElementById('new-game-btn').addEventListener('click', startGame);
    document.getElementById('restart-btn').addEventListener('click', () => {
      hideModal(gameOverModal);
      startGame();
    });
    document.getElementById('high-scores-btn').addEventListener('click', showHighScores);
    document.getElementById('close-scores-btn').addEventListener('click', () => hideModal(highScoresModal));
    document.getElementById('share-btn').addEventListener('click', shareScore);
    document.getElementById('sound-toggle-btn').addEventListener('click', () => {
      const enabled = toggleSound();
      document.getElementById('sound-toggle-btn').textContent = enabled ? '🔊' : '🔈';
    });

    
    // Add settings button event listener
    document.getElementById('settings-btn').addEventListener('click', showSettings);
    document.getElementById('close-settings-btn').addEventListener('click', () => hideModal(document.getElementById('settings-modal')));
    document.getElementById('apply-settings-btn').addEventListener('click', applySettings);
    document.getElementById('reset-settings-btn').addEventListener('click', resetSettings);
    
    // Theme color sets
    const THEME_COLORS = {
      default: ['#FF3366', '#FF6633', '#FFCC33', '#33CC66', '#3366FF', '#CC33FF', '#FF33CC', '#33FFCC', '#FF9933', '#9933FF'],
      neon: ['#FF00FF', '#00FFFF', '#00FF00', '#FFFF00', '#FF0000', '#0000FF', '#FF00AA', '#00FFAA', '#AAFF00', '#AA00FF'],
      pastel: ['#FFB6C1', '#FFD700', '#98FB98', '#AFEEEE', '#D8BFD8', '#FFDAB9', '#B0E0E6', '#FFA07A', '#FFFACD', '#E6E6FA'],
      monochrome: ['#111111', '#333333', '#555555', '#777777', '#999999', '#BBBBBB', '#DDDDDD', '#EFEFEF', '#F5F5F5', '#FFFFFF'],
      dark: ['#8B0000', '#006400', '#00008B', '#4B0082', '#800080', '#8B4513', '#191970', '#556B2F', '#2F4F4F', '#000000'],
      
      // Time of day themes
      morning: ['#FF9AA2', '#FFB7B2', '#FFDAC1', '#E2F0CB', '#B5EAD7', '#C7CEEA', '#F8B195', '#F67280', '#C06C84', '#6C5B7B'],
      afternoon: ['#FFC107', '#FF9800', '#FF5722', '#F44336', '#E91E63', '#9C27B0', '#673AB7', '#3F51B5', '#2196F3', '#03A9F4'],
      evening: ['#4E4A59', '#6A6B83', '#8896AB', '#9DABC3', '#C5D5E4', '#D8DCEC', '#B0C0D9', '#8596B2', '#5D6C89', '#323752'],
      night: ['#0D1321', '#1D2D44', '#3E5C76', '#748CAB', '#F0EBD8', '#5085A5', '#31708E', '#687864', '#8FC1E3', '#0F3057'],
      
      // Season themes
      spring: ['#A8E6CE', '#DCEDC2', '#FFD3B5', '#FFAAA6', '#FF8C94', '#F8E9A1', '#F76C6C', '#A8D8EA', '#AA96DA', '#C6DABF'],
      summer: ['#FF9F1C', '#FFBF69', '#CBF3F0', '#2EC4B6', '#FFFFFF', '#FCBF49', '#F77F00', '#D62828', '#4CC9F0', '#FB8500'],
      autumn: ['#8D230F', '#C4594B', '#F29559', '#F2C14E', '#BF8A49', '#A45025', '#EC7357', '#754F44', '#D56F3E', '#9A8267'],
      winter: ['#E4F0F8', '#B9D6F2', '#A1C6EA', '#7A9CC6', '#3766A8', '#0353A4', '#1D3557', '#8AB8FE', '#D0E3FF', '#F0F3F5']
    };
    
    // CSS variable mappings for themes
    const THEME_VARS = {
      default: {
        '--primary-color': '#4a00e0',
        '--secondary-color': '#8e2de2',
        '--text-color': '#ffffff',
        '--grid-bg': 'rgba(255, 255, 255, 0.1)',
        '--tile-border': 'rgba(255, 255, 255, 0.2)',
        '--power-up-color': '#FFD700',
        '--power-up-glow': '0 0 15px #FFD700'
      },
      neon: {
        '--primary-color': '#000000',
        '--secondary-color': '#221133',
        '--text-color': '#00FFFF',
        '--grid-bg': 'rgba(0, 255, 255, 0.1)',
        '--tile-border': 'rgba(255, 0, 255, 0.4)',
        '--power-up-color': '#FF00FF',
        '--power-up-glow': '0 0 15px #FF00FF'
      },
      pastel: {
        '--primary-color': '#B19CD9',
        '--secondary-color': '#FFB6C1',
        '--text-color': '#ffffff',
        '--grid-bg': 'rgba(255, 255, 255, 0.15)',
        '--tile-border': 'rgba(255, 255, 255, 0.3)',
        '--power-up-color': '#FFD700',
        '--power-up-glow': '0 0 15px #FFD700'
      },
      monochrome: {
        '--primary-color': '#222222',
        '--secondary-color': '#444444',
        '--text-color': '#FFFFFF',
        '--grid-bg': 'rgba(255, 255, 255, 0.1)',
        '--tile-border': 'rgba(255, 255, 255, 0.15)',
        '--power-up-color': '#FFFFFF',
        '--power-up-glow': '0 0 15px #FFFFFF'
      },
      dark: {
        '--primary-color': '#300000',
        '--secondary-color': '#000030',
        '--text-color': '#FF8888',
        '--grid-bg': 'rgba(50, 0, 0, 0.3)',
        '--tile-border': 'rgba(100, 0, 0, 0.3)',
        '--power-up-color': '#FFAA00',
        '--power-up-glow': '0 0 15px #FFAA00'
      },
      
      // Time of day themes
      morning: {
        '--primary-color': '#FF9AA2',
        '--secondary-color': '#FFDAC1',
        '--text-color': '#333333',
        '--grid-bg': 'rgba(255, 255, 255, 0.2)',
        '--tile-border': 'rgba(255, 218, 193, 0.4)',
        '--power-up-color': '#E2F0CB',
        '--power-up-glow': '0 0 15px #E2F0CB'
      },
      afternoon: {
        '--primary-color': '#FF9800',
        '--secondary-color': '#FFC107',
        '--text-color': '#ffffff',
        '--grid-bg': 'rgba(255, 255, 255, 0.15)',
        '--tile-border': 'rgba(255, 255, 255, 0.3)',
        '--power-up-color': '#2196F3',
        '--power-up-glow': '0 0 15px #2196F3'
      },
      evening: {
        '--primary-color': '#4E4A59',
        '--secondary-color': '#8896AB',
        '--text-color': '#D8DCEC',
        '--grid-bg': 'rgba(216, 220, 236, 0.1)',
        '--tile-border': 'rgba(216, 220, 236, 0.25)',
        '--power-up-color': '#C5D5E4',
        '--power-up-glow': '0 0 15px #C5D5E4'
      },
      night: {
        '--primary-color': '#0D1321',
        '--secondary-color': '#1D2D44',
        '--text-color': '#748CAB',
        '--grid-bg': 'rgba(116, 140, 171, 0.1)',
        '--tile-border': 'rgba(116, 140, 171, 0.2)',
        '--power-up-color': '#F0EBD8',
        '--power-up-glow': '0 0 15px #F0EBD8'
      },
      
      // Season themes
      spring: {
        '--primary-color': '#A8E6CE',
        '--secondary-color': '#DCEDC2',
        '--text-color': '#FF8C94',
        '--grid-bg': 'rgba(255, 140, 148, 0.1)',
        '--tile-border': 'rgba(255, 140, 148, 0.2)',
        '--power-up-color': '#F8E9A1',
        '--power-up-glow': '0 0 15px #F8E9A1'
      },
      summer: {
        '--primary-color': '#FF9F1C',
        '--secondary-color': '#FFBF69',
        '--text-color': '#2EC4B6',
        '--grid-bg': 'rgba(46, 196, 182, 0.1)',
        '--tile-border': 'rgba(46, 196, 182, 0.2)',
        '--power-up-color': '#4CC9F0',
        '--power-up-glow': '0 0 15px #4CC9F0'
      },
      autumn: {
        '--primary-color': '#8D230F',
        '--secondary-color': '#C4594B',
        '--text-color': '#F2C14E',
        '--grid-bg': 'rgba(242, 193, 78, 0.1)',
        '--tile-border': 'rgba(242, 193, 78, 0.2)',
        '--power-up-color': '#D56F3E',
        '--power-up-glow': '0 0 15px #D56F3E'
      },
      winter: {
        '--primary-color': '#1D3557',
        '--secondary-color': '#3766A8',
        '--text-color': '#E4F0F8',
        '--grid-bg': 'rgba(228, 240, 248, 0.1)',
        '--tile-border': 'rgba(228, 240, 248, 0.2)',
        '--power-up-color': '#D0E3FF',
        '--power-up-glow': '0 0 15px #D0E3FF'
      }
    };
    
    // Game settings object - will store current settings
    let gameSettings = {
      difficultyLevel: 3,
      timeMultiplier: 0.92,
      comboTimeout: 4000,
      startingTime: 50,
      theme: 'default'
    };
    
    // Function to show settings modal
    function showSettings() {
      // Update the settings UI with current values
      document.getElementById('difficulty-level').value = gameSettings.difficultyLevel;
      document.getElementById('difficulty-value').textContent = gameSettings.difficultyLevel;
      
      document.getElementById('time-multiplier').value = gameSettings.timeMultiplier;
      document.getElementById('time-multiplier-value').textContent = gameSettings.timeMultiplier;
      
      document.getElementById('combo-timeout').value = gameSettings.comboTimeout;
      document.getElementById('combo-timeout-value').textContent = gameSettings.comboTimeout;
      
      document.getElementById('starting-time').value = gameSettings.startingTime;
      document.getElementById('starting-time-value').textContent = gameSettings.startingTime;
      
      // Update theme buttons
      document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.theme === gameSettings.theme) {
          btn.classList.add('active');
        }
      });
      
      // Show the modal
      showModal(document.getElementById('settings-modal'));
      
      // Set up sliders to update their display values
      const sliders = document.querySelectorAll('#settings-modal input[type="range"]');
      sliders.forEach(slider => {
        slider.addEventListener('input', function() {
          document.getElementById(`${this.id}-value`).textContent = this.value;
        });
      });
      
      // Set up theme buttons
      document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.addEventListener('click', function() {
          document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
          this.classList.add('active');
        });
      });
    }
    
    // Function to apply settings
    function applySettings() {
      // Get values from settings UI
      gameSettings.difficultyLevel = parseFloat(document.getElementById('difficulty-level').value);
      gameSettings.timeMultiplier = parseFloat(document.getElementById('time-multiplier').value);
      gameSettings.comboTimeout = parseInt(document.getElementById('combo-timeout').value);
      gameSettings.startingTime = parseInt(document.getElementById('starting-time').value);
      
      // Get selected theme
      const activeThemeBtn = document.querySelector('.theme-btn.active');
      if (activeThemeBtn) {
        gameSettings.theme = activeThemeBtn.dataset.theme;
        localStorage.setItem('themePreference', gameSettings.theme);
      }
      
      // Apply settings to game
      applyDifficultySettings();
      applyTheme(gameSettings.theme);
      
      // Close the modal
      hideModal(document.getElementById('settings-modal'));
      
      // Show notification
      showPowerUpEffect('Settings Applied');
    }
    
    // Function to reset settings to defaults
    function resetSettings() {
      gameSettings = {
        difficultyLevel: 3,
        timeMultiplier: 0.92,
        comboTimeout: 4000,
        startingTime: 50,
        theme: 'default'
      };
      
      // Update UI
      document.getElementById('difficulty-level').value = gameSettings.difficultyLevel;
      document.getElementById('difficulty-value').textContent = gameSettings.difficultyLevel;
      
      document.getElementById('time-multiplier').value = gameSettings.timeMultiplier;
      document.getElementById('time-multiplier-value').textContent = gameSettings.timeMultiplier;
      
      document.getElementById('combo-timeout').value = gameSettings.comboTimeout;
      document.getElementById('combo-timeout-value').textContent = gameSettings.comboTimeout;
      
      document.getElementById('starting-time').value = gameSettings.startingTime;
      document.getElementById('starting-time-value').textContent = gameSettings.startingTime;
      
      // Reset theme buttons
      document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.theme === 'default') {
          btn.classList.add('active');
        }
      });
      
      // Apply default settings
      applyDifficultySettings();
      applyTheme('default');
      
      // Show notification
      showPowerUpEffect('Settings Reset');
    }
    
    // Function to apply difficulty settings to game config
    function applyDifficultySettings() {
      // Adjust difficulty factors based on slider
      const factor = gameSettings.difficultyLevel / 3; // 3 is the middle/default value
      
      // Update game configuration values
      BASE_LEVEL_CONFIG.timeMultiplier = gameSettings.timeMultiplier;
      BASE_LEVEL_CONFIG.startTime = gameSettings.startingTime;
      
      // Scale these based on difficulty factor
      BASE_LEVEL_CONFIG.pairMultiplier = 1.15 + (0.1 * factor);
      BASE_LEVEL_CONFIG.colorMultiplier = 1.1 + (0.05 * factor);
      BASE_LEVEL_CONFIG.minTime = Math.max(5, 10 - (2 * factor));
      
      // Update combo config
      COMBO_CONFIG.baseTimeout = gameSettings.comboTimeout;
      COMBO_CONFIG.minTimeout = Math.max(1000, 2000 - (500 * factor));
      COMBO_CONFIG.timeoutReductionPerLevel = 0.1 + (0.05 * factor);
      
      console.log('Applied difficulty settings:', {
        BASE_LEVEL_CONFIG,
        COMBO_CONFIG
      });
      
      // Update colors based on theme
      COLORS.splice(0, COLORS.length, ...THEME_COLORS[gameSettings.theme]);
      
      // If a game is in progress, these will apply to the next level
      // If user wants immediate effect, they should restart the game
    }
    
    // Function to apply a theme
    function applyTheme(themeName) {
      if (!THEME_VARS[themeName]) {
        console.error(`Theme ${themeName} not found`);
        return;
      }
      
      // Set CSS variables
      const root = document.documentElement;
      Object.entries(THEME_VARS[themeName]).forEach(([property, value]) => {
        root.style.setProperty(property, value);
      });
      
      // Update colors array with theme colors
      COLORS.splice(0, COLORS.length, ...THEME_COLORS[themeName]);
      
      console.log(`Applied theme: ${themeName}`);
    }
    
    // Add CSS for settings modal
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      .settings-section {
        margin-bottom: 20px;
        text-align: left;
      }
      
      .settings-section h3 {
        margin-bottom: 10px;
        color: #FFD700;
      }
      
      .setting-row {
        display: flex;
        align-items: center;
        margin-bottom: 10px;
      }
      
      .setting-row label {
        flex: 0 0 150px;
        margin-right: 10px;
      }
      
      .setting-row input[type="range"] {
        flex: 1;
        margin-right: 10px;
      }
      
      .setting-row span {
        flex: 0 0 50px;
        text-align: right;
      }
      
      .theme-options {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 10px;
      }
      
      .theme-btn {
        flex: 1 0 calc(25% - 10px);
        min-width: 80px;
        padding: 8px 5px;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: white;
        cursor: pointer;
        border-radius: 5px;
        transition: all 0.3s ease;
        margin-bottom: 5px;
      }
      
      .theme-btn:hover {
        background: rgba(255, 255, 255, 0.2);
      }
      
      .theme-btn.active {
        background: rgba(255, 215, 0, 0.3);
        border-color: #FFD700;
        box-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
      }
      
      .settings-actions {
        display: flex;
        justify-content: space-between;
        margin-top: 20px;
      }
      
      #settings-modal .modal-content {
        max-width: 500px;
        width: 90%;
      }
    `;
    document.head.appendChild(styleElement);
    
    // Initialize with default theme
    window.addEventListener('DOMContentLoaded', () => {
      applyTheme('default');
    });

    function initGame() {
      // Get auto-detected themes
      const { timeTheme, seasonTheme } = detectTimeAndSeason();
      
      // Create a settings option to store theme preference
      if (!localStorage.getItem('themePreference')) {
        // Default to auto-detected time theme if no preference exists
        localStorage.setItem('themePreference', timeTheme);
      }
      
      // Apply the stored theme preference
      const savedTheme = localStorage.getItem('themePreference');
      applyTheme(savedTheme);
      
      // Add auto theme detection toggle to the settings
      const themeSection = document.querySelector('.theme-options');
      if (themeSection) {
        // Add header for auto-detection info
        const autoHeader = document.createElement('div');
        autoHeader.className = 'auto-theme-header';
        autoHeader.style.width = '100%';
        autoHeader.style.marginTop = '15px';
        autoHeader.style.marginBottom = '5px';
        autoHeader.style.fontWeight = 'bold';
        autoHeader.textContent = 'Auto-Detected Themes:';
        themeSection.appendChild(autoHeader);
        
        // Add detected time theme button
        const timeThemeBtn = document.createElement('button');
        timeThemeBtn.className = 'theme-btn auto-theme';
        timeThemeBtn.dataset.theme = timeTheme;
        timeThemeBtn.innerHTML = `Time: <span>${timeTheme.charAt(0).toUpperCase() + timeTheme.slice(1)}</span>`;
        timeThemeBtn.style.backgroundColor = 'rgba(0, 150, 255, 0.2)';
        themeSection.appendChild(timeThemeBtn);
        
        // Add detected season theme button
        const seasonThemeBtn = document.createElement('button');
        seasonThemeBtn.className = 'theme-btn auto-theme';
        seasonThemeBtn.dataset.theme = seasonTheme;
        seasonThemeBtn.innerHTML = `Season: <span>${seasonTheme.charAt(0).toUpperCase() + seasonTheme.slice(1)}</span>`;
        seasonThemeBtn.style.backgroundColor = 'rgba(0, 150, 255, 0.2)';
        themeSection.appendChild(seasonThemeBtn);
        
        // Update the active button to match the currently applied theme
        document.querySelectorAll('.theme-btn').forEach(btn => {
          btn.classList.remove('active');
          if (btn.dataset.theme === savedTheme) {
            btn.classList.add('active');
          }
        });
        
        // Add event listeners to auto-theme buttons
        document.querySelectorAll('.auto-theme').forEach(btn => {
          btn.addEventListener('click', () => {
            document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            localStorage.setItem('themePreference', btn.dataset.theme);
            applyTheme(btn.dataset.theme);
          });
        });
      }
      
      loadHighScores();
      createGrid();
      showIntro();
    }

    function createGrid() {
      grid.innerHTML = '';

      // Add combo indicator and timer back to grid
      const comboIndicatorElem = document.createElement('div');
      comboIndicatorElem.className = 'combo-indicator';
      comboIndicatorElem.id = 'combo-indicator';
      comboIndicatorElem.textContent = '1x';
      grid.appendChild(comboIndicatorElem);

      const comboTimer = document.createElement('div');
      comboTimer.className = 'combo-timer';
      comboTimer.id = 'combo-timer';
      comboTimer.innerHTML = '<div class="combo-timer-fill" id="combo-timer-fill"></div>';
      grid.appendChild(comboTimer);

      for (let row = 0; row < 6; row++) {
        for (let col = 0; col < 6; col++) {
          const tile = document.createElement('div');
          tile.className = 'tile';
          tile.dataset.row = row;
          tile.dataset.col = col;
          tile.addEventListener('click', handleTileClick);
          grid.appendChild(tile);
        }
      }
    }

    function startGame() {
      forceEndAllCombos();
      
      // Initialize audio context on game start for better mobile support
      initAudioContext();
      
      // Add game-active class to show we're playing
      document.querySelector('.game-container').classList.add('game-active');
      
      // Remove any intro elements or level complete elements
      document.querySelectorAll('.intro-text, .intro-tile, .demo-trail, .level-complete, .next-level-btn, .start-screen').forEach(el => el.remove());
      grid.style.animation = '';

      gameState = {
        level: 1,
        score: 0,
        matches: 0,
        timeLeft: calculateLevelConfig(1).time,
        selectedTile: null,
        connecting: false,
        gameActive: true,
        tiles: [],
        timerInterval: null,
        scoreMultiplier: 1,
        soundEnabled: playerProfile.preferences.soundEnabled,
        consecutiveMatches: 0,
        comboMultiplier: 1,
        comboChain: [],
        comboConnections: [],
        activeComboColor: null,
        comboTimeoutId: null,
        highScores: playerProfile.highScores || [],
        comboTrails: [],
        // Reset tracking fields
        gameStartTime: Date.now(),
        combosAchieved: 0,
        bestCombo: 0,
        perfectClear: true
      };

      scoreElement.textContent = gameState.score;
      levelElement.textContent = gameState.level;
      matchesElement.textContent = gameState.matches;
      
      // Reset level display styling
      levelElement.style.color = '';
      levelElement.style.textShadow = '';

      if (gameState.timerInterval) {
        clearInterval(gameState.timerInterval);
      }
      
      // Add CSS for difficulty display
      const styleElement = document.createElement('style');
      styleElement.textContent = `
        .difficulty-novice {
          color: #33cc66;
        }
        .difficulty-advanced {
          color: #33ccff;
        }
        .difficulty-expert {
          color: #ffcc33;
        }
        .difficulty-master {
          color: #ff9933;
        }
        .difficulty-grandmaster {
          color: #ff3366;
          text-shadow: 0 0 5px rgba(255, 51, 102, 0.5);
        }
        .difficulty-legendary {
          color: #cc33ff;
          text-shadow: 0 0 10px rgba(204, 51, 255, 0.7);
          animation: pulseDifficulty 1s infinite alternate;
        }
        
        @keyframes pulseDifficulty {
          from { opacity: 0.7; }
          to { opacity: 1; }
        }
      `;
      document.head.appendChild(styleElement);
      
      // Update difficulty display
      updateLevelDifficultyDisplay();
      
      // Recreate the grid to ensure it's clean
      createGrid();
      generateLevel();
      startTimer();
    }

    function generateLevel() {
      if (gameState.activeComboColor) {
        endCombo();
      }

      const levelConfig = calculateLevelConfig(gameState.level);
      const tiles = document.querySelectorAll('.tile');
      
      // Clear existing tiles
      gameState.tiles = [];
      
      // Clear any existing connections
      document.querySelectorAll('.connection-line, .combo-connection').forEach(line => line.remove());
      
      // Clear all tile styles and content
      tiles.forEach(tile => {
        tile.className = 'tile';
        tile.dataset.color = '';
        tile.innerHTML = '';
        delete tile.dataset.powerUp;
      });
      
      // Calculate how many of each color to use
      const pairsPerColor = Math.floor(levelConfig.pairs / levelConfig.colors);
      let remainingPairs = levelConfig.pairs % levelConfig.colors;
      
      // Distribute colors
      const colorsToUse = COLORS.slice(0, levelConfig.colors);
      const colorDistribution = {};
      
      colorsToUse.forEach(color => {
        colorDistribution[color] = pairsPerColor * 2;
        if (remainingPairs > 0) {
          colorDistribution[color] += 2;
          remainingPairs--;
        }
      });
      
      // Create shuffled array of colors
      let colorArray = [];
      Object.entries(colorDistribution).forEach(([color, count]) => {
        for (let i = 0; i < count; i++) {
          colorArray.push(color);
        }
      });
      
      // Shuffle color array
      colorArray = shuffleArray(colorArray);
      
      // Pad with empty tiles if needed
      while (colorArray.length < 36) {
        colorArray.push(null);
      }
      
      // Assign colors to tiles
      tiles.forEach((tile, index) => {
        const tileColor = colorArray[index];
        
        if (tileColor) {
          const tileContent = document.createElement('div');
          tileContent.className = 'tile-content';
          tileContent.style.backgroundColor = tileColor;
          tile.appendChild(tileContent);
          tile.dataset.color = tileColor;
          
          // Add power-up with decreased probability in higher levels
          if (Math.random() < levelConfig.powerUpChance) {
            // Different power-up distribution based on level
            // Higher levels get fewer time bonuses and more difficult power-ups
            let powerUpTypes = ['bonus', 'time', 'mult'];
            let weights;
            
            if (gameState.level <= 20) {
              // Early levels: balanced distribution
              weights = [0.4, 0.4, 0.2]; 
            } else if (gameState.level <= 50) {
              // Mid levels: fewer time bonuses
              weights = [0.5, 0.2, 0.3]; 
            } else {
              // Hard levels: minimal time bonuses, mostly score modifiers
              weights = [0.6, 0.1, 0.3]; 
            }
            
            // Weight-based random selection
            const powerUpType = weightedRandom(powerUpTypes, weights);
            addPowerUpToTile(tile, powerUpType);
          }
          
          // Add tile to game state
          gameState.tiles.push({
            element: tile,
            color: tileColor,
            row: parseInt(tile.dataset.row),
            col: parseInt(tile.dataset.col),
            matched: false
          });
        }
      });
      
      // Update timer based on level config
      gameState.timeLeft = levelConfig.time;
      gameState.initialTime = levelConfig.time;
      
      // Update combo timeout
      COMBO_CONFIG.currentTimeout = levelConfig.comboTimeout;
      
      // Initialize timer display
      updateTimerBar();
      
      // Re-enable input
      gameState.connecting = false;
      gameState.selectedTile = null;
      
      // Update level display with additional flair for significant levels
      levelElement.textContent = gameState.level;
      if (gameState.level > 20) {
        levelElement.style.color = '#FF9500';
      }
      if (gameState.level > 50) {
        levelElement.style.color = '#FF5500';
        levelElement.style.textShadow = '0 0 10px rgba(255, 85, 0, 0.7)';
      }
      
      console.log(`Generated level ${gameState.level} with ${gameState.tiles.length} tiles`);
    }
    
    // Helper function for weighted random selection
    function weightedRandom(items, weights) {
      if (items.length !== weights.length) {
        throw new Error('Items and weights must be the same length');
      }
      
      const cumulativeWeights = [];
      let sum = 0;
      
      for (let i = 0; i < weights.length; i++) {
        sum += weights[i];
        cumulativeWeights.push(sum);
      }
      
      const random = Math.random() * sum;
      
      for (let i = 0; i < cumulativeWeights.length; i++) {
        if (random < cumulativeWeights[i]) {
          return items[i];
        }
      }
      
      return items[0]; // Fallback
    }

    function handleTileClick(event) {
      if (!gameState.gameActive) return;

      const tile = event.target.closest('.tile');
      if (!tile) return;

      const color = tile.dataset.color;
      if (!color || tile.classList.contains('tile-matched')) return;

      playSound('select');

      // Check if there's only one tile left for each color (singleton mode)
      const singletonMode = isSingletonMode();
      
      // If in singleton mode, handle differently
      if (singletonMode) {
        console.log("Singleton mode - handling individual tile click");
        
        // Mark the tile as matched directly
        tile.classList.add('tile-matched');
        fadeOutTile(tile);
        
        // Update the game state
        gameState.tiles.forEach(t => {
          if (t.element === tile) {
            t.matched = true;
          }
        });
        
        // Handle power-ups if present
        if (tile.dataset.powerUp) {
          activatePowerUp(tile);
        }
        
        // Award points
        const scoreIncrease = 10 * gameState.level;
        gameState.score += scoreIncrease;
        scoreElement.textContent = gameState.score;
        
        // Increment match count
        gameState.matches++;
        matchesElement.textContent = gameState.matches;
        
        // Check if level is complete
        checkLevelComplete();
        
        return;
      }

      // If we have an active combo and this tile matches the combo color
      // AND this tile isn't already in the combo chain, add it directly
      if (gameState.activeComboColor && 
          gameState.activeComboColor === color && 
          !gameState.comboChain.includes(tile) &&
          !tile.classList.contains('tile-matched')) {
        
        // Get the last tile in the combo chain
        const lastTile = gameState.comboChain[gameState.comboChain.length - 1];
        
        // Add the new tile to the chain
        gameState.comboChain.push(tile);
        
        // Apply visual styling
        tile.classList.add('tile-in-combo');
        tile.style.setProperty('--combo-color', color);
        
        // Create visual connection between the last tile and this one
        createComboTrail(lastTile, tile, color);
        
        // Update combo multiplier
        gameState.comboMultiplier = Math.min(COMBO_CONFIG.maxComboMultiplier, gameState.comboChain.length);
        
        // Track best combo
        gameState.bestCombo = Math.max(gameState.bestCombo, gameState.comboMultiplier);
        
        // Update the UI
        showComboText(gameState.comboMultiplier);
        
        // Check for combo achievements
        checkComboAchievements(gameState.comboMultiplier);
        
        // Reset the combo timeout
        if (gameState.comboTimeoutId) {
          clearTimeout(gameState.comboTimeoutId);
        }
        
        gameState.comboTimeoutId = setTimeout(() => {
          console.log("Combo timer expired");
          endCombo();
        }, getComboTimeout(gameState.level));
        
        // Update score
        const scoreIncrease = 10 * gameState.level * gameState.comboMultiplier;
        gameState.score += scoreIncrease;
        
        // Don't increment matches yet - we only count a match when the combo ends
        scoreElement.textContent = gameState.score;
        
        // Check if all tiles of this color are now in the combo
        if (checkAllColorTilesMatched(color)) {
          console.log("All tiles of this color are matched, ending combo automatically");
          // End the combo immediately
          clearTimeout(gameState.comboTimeoutId);
          endCombo();
        }
        
        return; // Skip the rest of the function
      } else if (gameState.activeComboColor && color !== gameState.activeComboColor) {
        // Different color clicked while in a combo - end the current combo
        console.log("Different color clicked, ending current combo");
        endCombo();
      }

      // Normal selection logic for starting a combo
      if (!gameState.selectedTile) {
        // First tile selected
        gameState.selectedTile = tile;
        tile.classList.add('selected');
      } else if (gameState.selectedTile === tile) {
        // Same tile clicked twice
        gameState.selectedTile.classList.remove('selected');
        gameState.selectedTile = null;
      } else {
        // A different tile was selected
        const firstTile = gameState.selectedTile;
        const firstColor = firstTile.dataset.color;
        
        // Clear selection
        gameState.selectedTile.classList.remove('selected');
        gameState.selectedTile = null;
        
        if (firstColor === color) {
          // Colors match! Start a new combo
          playSound('match');
          
          // End any existing combo first
          if (gameState.activeComboColor) {
            console.log(`Ending previous combo with color ${gameState.activeComboColor}`);
            endCombo();
          }
          
          // Initialize the new combo
          gameState.activeComboColor = color;
          gameState.comboChain = [firstTile, tile];
          gameState.comboMultiplier = 2; // Start with 2 for a pair
          
          // Apply visual styling
          firstTile.classList.add('tile-in-combo');
          tile.classList.add('tile-in-combo');
          firstTile.style.setProperty('--combo-color', color);
          tile.style.setProperty('--combo-color', color);
          
          // Create visual connection between the two tiles
          createComboTrail(firstTile, tile, color);
          
          // Update the UI
          showComboText(gameState.comboMultiplier);
          
          // Reset the combo timeout
          if (gameState.comboTimeoutId) {
            clearTimeout(gameState.comboTimeoutId);
          }
          
          gameState.comboTimeoutId = setTimeout(() => {
            console.log("Combo timer expired");
            endCombo();
          }, getComboTimeout(gameState.level));
          
          // Update score
          const scoreIncrease = 10 * gameState.level * gameState.comboMultiplier;
          gameState.score += scoreIncrease;
          
          // Don't increment matches yet - we only count a match when the combo ends
          scoreElement.textContent = gameState.score;
          
          // Check if all tiles of this color are now in the combo
          if (checkAllColorTilesMatched(color)) {
            console.log("All tiles of this color are matched, ending combo automatically");
            // End the combo immediately
            clearTimeout(gameState.comboTimeoutId);
            endCombo();
          }
        } else {
          // Colors don't match
          console.log(`Colors don't match: ${firstColor} vs ${color}`);
          
          // End any active combo
          if (gameState.activeComboColor) {
            console.log("Ending combo because different color selected");
            endCombo();
          }
          
          // Select the new tile
          gameState.selectedTile = tile;
          tile.classList.add('selected');
        }
      }
    }

    function createComboTrail(fromTile, toTile, color) {
      console.log("Creating combo trail between tiles");
      
      // Get positions
      const gridRect = grid.getBoundingClientRect();
      const fromRect = fromTile.getBoundingClientRect();
      const toRect = toTile.getBoundingClientRect();
      
      // Calculate centers
      const x1 = fromRect.left + fromRect.width/2 - gridRect.left;
      const y1 = fromRect.top + fromRect.height/2 - gridRect.top;
      const x2 = toRect.left + toRect.width/2 - gridRect.left;
      const y2 = toRect.top + toRect.height/2 - gridRect.top;
      
      console.log(`Creating particles from (${x1},${y1}) to (${x2},${y2})`);
      
      // Create particles between the tiles
      const numParticles = 8;
      for (let i = 0; i < numParticles; i++) {
        const ratio = (i + 1) / (numParticles + 1);
        
        // Add some randomness to positions
        const randomOffsetX = (Math.random() - 0.5) * 10;
        const randomOffsetY = (Math.random() - 0.5) * 10;
        
        const x = x1 + (x2 - x1) * ratio + randomOffsetX;
        const y = y1 + (y2 - y1) * ratio + randomOffsetY;
        
        // Randomize particle size
        const size = 5 + Math.random() * 10;
        
        const particle = document.createElement('div');
        particle.className = 'combo-trail';
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        particle.style.left = `${x - size/2}px`;
        particle.style.top = `${y - size/2}px`;
        particle.style.backgroundColor = color;
        particle.style.boxShadow = `0 0 ${5 + Math.random() * 10}px ${color}`;
        particle.style.animationDelay = `${Math.random() * 2}s`;
        particle.style.position = 'absolute';
        particle.style.borderRadius = '50%';
        particle.style.pointerEvents = 'none';
        particle.style.zIndex = '15';
        
        grid.appendChild(particle);
        
        // Store the particle
        if (!gameState.comboTrails) {
          gameState.comboTrails = [];
        }
        gameState.comboTrails.push(particle);
      }
    }

    function showComboText(comboCount) {
      // Remove any existing combo text
      document.querySelectorAll('.notification-message').forEach(el => el.remove());
      
      // Get the notification area
      const notificationArea = document.getElementById('notification-area');
      
      // Create and show the new combo text
      const comboText = document.createElement('div');
      comboText.className = 'notification-message';
      comboText.textContent = `COMBO ${comboCount}X`;
      notificationArea.appendChild(comboText);
      
      // Remove the text after animation completes
      setTimeout(() => {
        if (comboText.parentNode) {
          comboText.remove();
        }
      }, 2000);
      
      // Update the persistent combo indicator
      comboIndicator.textContent = `${comboCount}x`;
      comboIndicator.style.color = gameState.activeComboColor;
      comboIndicator.classList.add('active');
      
      // Show and animate the combo timer
      const comboTimer = document.getElementById('combo-timer');
      comboTimer.classList.add('active');
      
      const comboTimerFill = document.getElementById('combo-timer-fill');
      comboTimerFill.style.transition = 'none';
      comboTimerFill.style.transform = 'scaleX(1)';
      
      // Force reflow
      void comboTimerFill.offsetWidth;
      
      // Start countdown animation
      comboTimerFill.style.transition = `transform ${getComboTimeout(gameState.level)/1000}s linear`;
      comboTimerFill.style.transform = 'scaleX(0)';
    }

    function endCombo() {
      console.log("Ending combo");
      if (!gameState.activeComboColor || gameState.comboChain.length === 0) {
        console.log("No active combo to end");
        return;
      }

      console.log(`Ending combo with ${gameState.comboChain.length} tiles and multiplier ${gameState.comboMultiplier}`);

      // Count this as one match regardless of how many tiles were in the combo
      gameState.matches++;
      matchesElement.textContent = gameState.matches;
      console.log(`Matches updated: ${gameState.matches}`);
      
      // Track combo completion
      if (gameState.comboMultiplier >= 2) {
        gameState.combosAchieved++;
      }

      // Award combo bonus for 3+ tiles
      if (gameState.comboMultiplier >= 3) {
        const comboBonus = 50 * gameState.comboMultiplier * gameState.level;
        gameState.score += comboBonus;
        showPowerUpEffect(`COMBO BONUS: +${comboBonus}`);
        scoreElement.textContent = gameState.score;
        console.log(`Awarded combo bonus: ${comboBonus}`);
      }

      comboIndicator.classList.remove('active');
      document.getElementById('combo-timer').classList.remove('active');

      // Remove combo styling from all tiles
      gameState.comboChain.forEach(tile => {
        if (tile && tile.classList) {
          tile.classList.remove('tile-in-combo');
          tile.style.removeProperty('--combo-color');
        }
      });

      // Clear all trail particles with a fade effect
      if (gameState.comboTrails && gameState.comboTrails.length > 0) {
        gameState.comboTrails.forEach(particle => {
          if (particle && particle.parentNode) {
            // Add fade-out animation
            particle.style.transition = "all 0.5s ease";
            particle.style.opacity = "0";
            particle.style.transform = "scale(0.1)";
            
            // Remove after animation completes
            setTimeout(() => {
              if (particle.parentNode) {
                particle.remove();
              }
            }, 500);
          }
        });
        gameState.comboTrails = [];
      }

      // Mark matched tiles
      const tilesToRemove = [...gameState.comboChain];
      tilesToRemove.forEach(tile => {
        if (tile && tile.classList) {
          // Check if this is a power-up tile and activate it
          if (tile.dataset.powerUp) {
            activatePowerUp(tile);
          }
          
          tile.classList.add('tile-matched');
          fadeOutTile(tile);
          gameState.tiles.forEach(t => {
            if (t.element === tile) {
              t.matched = true;
            }
          });
        }
      });

      // Reset combo state
      gameState.comboChain = [];
      gameState.consecutiveMatches = 0;
      gameState.comboMultiplier = 1;
      gameState.activeComboColor = null;
      if (gameState.comboTimeoutId) {
        clearTimeout(gameState.comboTimeoutId);
        gameState.comboTimeoutId = null;
      }
      
      // Check if level is complete after ending the combo
      checkLevelComplete();
    }

    function fadeOutTile(tile) {
      Array.from(tile.classList).forEach(className => {
        if (className !== 'tile' && className !== 'tile-matched') {
          tile.classList.remove(className);
        }
      });
      tile.style.opacity = '';
      tile.style.transform = '';
      tile.style.boxShadow = 'none';
      tile.style.border = 'none';
      const tileContent = tile.querySelector('.tile-content');
      if (tileContent) {
        tileContent.style.transition = "all 0.3s ease";
        tileContent.style.transform = "scale(0)";
        tileContent.style.opacity = "0";
      }
      const indicator = tile.querySelector('.power-up-indicator');
      if (indicator) {
        indicator.remove();
      }
      if (tile.dataset.powerUp) {
        tile.dataset.powerUp = '';
      }
    }

    function activatePowerUp(tile) {
      const powerType = tile.dataset.powerUp;
      if (!powerType) return;
      const powerUp = POWER_UPS[powerType];
      if (!powerUp) {
        console.error(`Power-up type not found: ${powerType}`);
        return;
      }
      if (typeof powerUp.activate === 'function') {
        powerUp.activate();
      }
      tile.dataset.powerUp = '';
      tile.classList.remove('power-up');
      const indicator = tile.querySelector('.power-up-indicator');
      if (indicator) {
        indicator.style.transition = "all 0.3s ease";
        indicator.style.opacity = "0";
      }
      tile.removeEventListener('mouseenter', showPowerUpTooltip);
      tile.removeEventListener('mouseleave', hidePowerUpTooltip);
    }

    function checkLevelComplete() {
      // End any active combo
      if (gameState.activeComboColor) {
        endCombo();
      }
      
      // Check if all tiles are matched
      const allTilesMatched = gameState.tiles.every(tile => tile.matched || !tile.element.dataset.color);
      console.log(`Checking level completion: All tiles matched? ${allTilesMatched}`);
      
      // Check if we've matched all tiles for this level
      if (allTilesMatched) {
        console.log(`Level ${gameState.level} complete! All tiles have been matched.`);
        
        // Stop the timer
        clearInterval(gameState.timerInterval);
        
        // Clean up any remaining tiles
        document.querySelectorAll('.tile').forEach(tile => {
          if (tile.classList.contains('tile-in-combo')) {
            fadeOutTile(tile);
          }
        });
        
        // Get the notification area
        const notificationArea = document.getElementById('notification-area');
        
        // Show level complete message in notification area
        const levelCompleteText = document.createElement('div');
        levelCompleteText.className = 'notification-message';
        levelCompleteText.textContent = `LEVEL ${gameState.level} COMPLETE!`;
        levelCompleteText.style.fontSize = '1.8rem';
        levelCompleteText.style.color = '#FFD700';
        levelCompleteText.style.boxShadow = '0 0 20px rgba(255, 215, 0, 0.8)';
        notificationArea.appendChild(levelCompleteText);
        
        // Add a level transition animation
        grid.style.animation = 'gridPulse 1s 3';
        
        // Play level up sound
        playSound('levelup');
        
        // Check if this is a milestone level (multiples of 20)
        if (gameState.level % 20 === 0) {
          // Show a special milestone message
          setTimeout(() => {
            const milestoneMessage = document.createElement('div');
            milestoneMessage.className = 'notification-message';
            milestoneMessage.textContent = `MILESTONE REACHED: LEVEL ${gameState.level}`;
            milestoneMessage.style.fontSize = '1.6rem';
            milestoneMessage.style.color = '#FF5500';
            milestoneMessage.style.boxShadow = '0 0 20px rgba(255, 85, 0, 0.8)';
            notificationArea.appendChild(milestoneMessage);
            
            // Offer challenge mode at levels 20, 40, 60, 80
            if (gameState.level % 40 === 0 && gameState.level < 100) {
              setTimeout(() => {
                showChallengeOffer();
              }, 2000);
            } else {
              setTimeout(() => {
                milestoneMessage.remove();
              }, 3000);
            }
          }, 1500);
        }
        
        // Show a "Next Level" button
        const nextLevelBtn = document.createElement('button');
        nextLevelBtn.className = 'next-level-btn';
        nextLevelBtn.textContent = 'Next Level';
        nextLevelBtn.style.position = 'absolute';
        nextLevelBtn.style.bottom = '20px';
        nextLevelBtn.style.left = '50%';
        nextLevelBtn.style.transform = 'translateX(-50%)';
        nextLevelBtn.style.padding = '10px 30px';
        nextLevelBtn.style.fontSize = '1.2rem';
        nextLevelBtn.style.backgroundColor = 'gold';
        nextLevelBtn.style.color = 'black';
        nextLevelBtn.style.border = 'none';
        nextLevelBtn.style.borderRadius = '50px';
        nextLevelBtn.style.cursor = 'pointer';
        nextLevelBtn.style.boxShadow = '0 0 20px gold';
        nextLevelBtn.style.zIndex = '100';
        nextLevelBtn.style.animation = 'fadeIn 0.5s ease-out 1s forwards';
        nextLevelBtn.style.opacity = '0';
        
        // Function to advance to next level
        const advanceToNextLevel = () => {
          console.log(`Advancing to level ${gameState.level + 1}`);
          // Remove notification text
          levelCompleteText.remove();
          
          // Remove next level button
          nextLevelBtn.remove();
          
          // Advance to the next level
          gameState.level++;
          levelElement.textContent = gameState.level;
          
          // Update difficulty display for new level
          updateLevelDifficultyDisplay();
          
          // Reset the grid and generate a new level
          document.querySelectorAll('.connection-line, .combo-connection').forEach(line => line.remove());
          generateLevel();
          
          // Restart the timer
          startTimer();
        };
        
        // Add the button to the grid
        grid.appendChild(nextLevelBtn);
        
        // Add click event to advance to next level
        nextLevelBtn.addEventListener('click', advanceToNextLevel);
        
        // Auto-advance after 10 seconds if button not clicked
        const autoAdvanceTimeout = setTimeout(() => {
          if (document.body.contains(nextLevelBtn)) {
            advanceToNextLevel();
          }
        }, 10000);
        
        // Clean up event listener when button is clicked
        nextLevelBtn.addEventListener('click', () => {
          clearTimeout(autoAdvanceTimeout);
        });
      }
    }
    
    // Show challenge offer when reaching milestone levels
    function showChallengeOffer() {
      // Create modal for challenge offer
      const modal = document.createElement('div');
      modal.className = 'modal';
      modal.id = 'challenge-modal';
      modal.style.display = 'block';
      
      const modalContent = document.createElement('div');
      modalContent.className = 'modal-content';
      
      // Add challenge mode content
      const title = document.createElement('h2');
      title.textContent = 'CHALLENGE MODE';
      title.style.color = '#FF5500';
      title.style.textShadow = '0 0 10px rgba(255, 85, 0, 0.7)';
      
      const description = document.createElement('p');
      description.innerHTML = 'Ready to push your limits, <strong>Eva</strong>? Challenge Mode will:<br><br>' + 
                             '• Skip ahead 5 levels<br>' +
                             '• Reduce time by 25%<br>' +
                             '• Increase score multiplier by 3x<br>' +
                             '• Unlock special achievements';
      description.style.textAlign = 'left';
      description.style.lineHeight = '1.5';
      
      // Create buttons
      const buttonContainer = document.createElement('div');
      buttonContainer.style.display = 'flex';
      buttonContainer.style.justifyContent = 'space-between';
      buttonContainer.style.marginTop = '20px';
      
      const acceptBtn = document.createElement('button');
      acceptBtn.textContent = 'Accept Challenge';
      acceptBtn.style.backgroundColor = '#FF5500';
      acceptBtn.style.color = 'white';
      acceptBtn.style.padding = '10px 20px';
      acceptBtn.style.border = 'none';
      acceptBtn.style.borderRadius = '5px';
      acceptBtn.style.cursor = 'pointer';
      acceptBtn.style.fontWeight = 'bold';
      acceptBtn.style.boxShadow = '0 0 10px rgba(255, 85, 0, 0.5)';
      
      const declineBtn = document.createElement('button');
      declineBtn.textContent = 'Continue Normal';
      declineBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
      declineBtn.style.color = 'white';
      declineBtn.style.padding = '10px 20px';
      declineBtn.style.border = 'none';
      declineBtn.style.borderRadius = '5px';
      declineBtn.style.cursor = 'pointer';
      
      // Add elements to modal
      buttonContainer.appendChild(declineBtn);
      buttonContainer.appendChild(acceptBtn);
      
      modalContent.appendChild(title);
      modalContent.appendChild(description);
      modalContent.appendChild(buttonContainer);
      
      modal.appendChild(modalContent);
      document.body.appendChild(modal);
      
      // Event handlers for buttons
      acceptBtn.addEventListener('click', () => {
        // Accept challenge mode
        gameState.level += 5; // Skip 5 levels
        gameState.scoreMultiplier = 3; // Triple score multiplier
        gameState.challengeMode = true;
        
        // Update level display
        levelElement.textContent = gameState.level;
        updateLevelDifficultyDisplay();
        
        // Show notification
        showPowerUpEffect('CHALLENGE ACCEPTED!');
        
        // Remove modal
        modal.remove();
        
        // Generate new level with increased difficulty
        generateLevel();
        
        // Reduce time by 25%
        gameState.timeLeft = Math.floor(gameState.timeLeft * 0.75);
        gameState.initialTime = gameState.timeLeft;
        updateTimerBar();
        
        // Restart timer
        startTimer();
      });
      
      declineBtn.addEventListener('click', () => {
        // Continue with normal game
        modal.remove();
        
        // Show notification
        showPowerUpEffect('Challenge Declined');
        
        // Generate next level normally
        generateLevel();
        startTimer();
      });
    }

    function startTimer() {
      clearInterval(gameState.timerInterval);
      gameState.timerInterval = setInterval(() => {
        gameState.timeLeft--;
        updateTimerBar();
        if (gameState.timeLeft <= 0) {
          endGame(false);
        }
      }, 1000);
    }

    function updateTimerBar() {
      const levelConfig = calculateLevelConfig(gameState.level);
      const percentage = (gameState.timeLeft / levelConfig.time) * 100;
      timerBar.style.width = `${percentage}%`;
      timerBar.classList.remove('warning', 'danger');
      if (percentage < 30) {
        timerBar.classList.add('danger');
      } else if (percentage < 60) {
        timerBar.classList.add('warning');
      }
    }

    function endGame(completed) {
      clearInterval(gameState.timerInterval);
      gameState.gameActive = false;
      
      // Remove game-active class to restore normal interface
      document.querySelector('.game-container').classList.remove('game-active');
      
      clearConnectionLines();
      document.querySelectorAll('.power-up-tooltip, .combo-text, .level-complete').forEach(el => el.remove());
      gameState.comboChain = [];
      gameState.consecutiveMatches = 0;
      gameState.comboMultiplier = 1;
      gameState.activeComboColor = null;
      if (gameState.comboTimeoutId) {
        clearTimeout(gameState.comboTimeoutId);
        gameState.comboTimeoutId = null;
      }
      comboIndicator.classList.remove('active');
      if (completed) {
        gameState.score += gameState.level * 500;
        scoreElement.textContent = gameState.score;
      }
      // Calculate play time
      const playTime = Math.floor((Date.now() - gameState.gameStartTime) / 1000);
      
      // Update player profile with game stats
      const updatedProfile = PlayerProfile.updateStats({
        score: gameState.score,
        level: gameState.level,
        matches: gameState.matches,
        combosAchieved: gameState.combosAchieved,
        bestCombo: gameState.bestCombo,
        playTime: playTime
      });
      
      // Check for first game achievement
      if (updatedProfile.stats.gamesPlayed === 1 && PlayerProfile.addAchievement(ACHIEVEMENTS.find(a => a.id === 'first_game'))) {
        setTimeout(() => showAchievementUnlocked('Welcome!'), 1000);
      }
      
      // Check score achievements
      checkScoreAchievements(gameState.score);
      
      // Check level achievements
      checkLevelAchievements(gameState.level);
      
      updateHighScores(gameState.score);
      finalScoreElement.textContent = gameState.score;
      showModal(gameOverModal);
    }

    function loadHighScores() {
      const highScores = JSON.parse(localStorage.getItem('matchingGameHighScores')) || [];
      return highScores;
    }

    function updateHighScores(score) {
      const profile = PlayerProfile.load();
      profile.highScores.push({
        score: score,
        level: gameState.level,
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString(),
        combos: gameState.combosAchieved,
        bestCombo: gameState.bestCombo
      });
      profile.highScores.sort((a, b) => b.score - a.score).splice(10);
      PlayerProfile.save(profile);
    }

    function showHighScores() {
      const profile = PlayerProfile.load();
      const highScores = profile.highScores;
      highScoresList.innerHTML = '';
      
      // Add player stats header
      const statsHeader = document.createElement('div');
      statsHeader.className = 'stats-header';
      statsHeader.innerHTML = `
        <h3>Career Statistics</h3>
        <div class="stats-grid">
          <div class="stat-item">
            <span class="stat-label">Games Played</span>
            <span class="stat-value">${profile.stats.gamesPlayed}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Highest Score</span>
            <span class="stat-value">${profile.stats.highestScore.toLocaleString()}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Highest Level</span>
            <span class="stat-value">${profile.stats.highestLevel}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Best Combo</span>
            <span class="stat-value">${profile.stats.bestCombo}x</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Avg Score</span>
            <span class="stat-value">${profile.stats.avgScore.toLocaleString()}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Total Matches</span>
            <span class="stat-value">${profile.stats.totalMatches}</span>
          </div>
        </div>
        <h3 style="margin-top: 20px;">Top 10 Scores</h3>
      `;
      highScoresList.appendChild(statsHeader);
      
      if (highScores.length === 0) {
        highScoresList.innerHTML += '<p>No high scores yet. Play a game!</p>';
      } else {
        highScores.forEach((entry, index) => {
          const scoreItem = document.createElement('div');
          scoreItem.className = 'score-item-detailed';
          scoreItem.innerHTML = `
            <div class="score-rank">#${index + 1}</div>
            <div class="score-details">
              <div class="score-main">
                <span class="score-value">${entry.score.toLocaleString()}</span>
                <span class="score-level">Level ${entry.level}</span>
              </div>
              <div class="score-meta">
                <span>${entry.date} ${entry.time || ''}</span>
                ${entry.combos ? `<span>• ${entry.combos} combos</span>` : ''}
                ${entry.bestCombo ? `<span>• Best: ${entry.bestCombo}x</span>` : ''}
              </div>
            </div>
          `;
          highScoresList.appendChild(scoreItem);
        });
      }
      
      // Add achievements section
      const achievementsSection = document.createElement('div');
      achievementsSection.className = 'achievements-section';
      achievementsSection.innerHTML = '<h3 style="margin-top: 20px;">Achievements</h3>';
      
      const achievementsGrid = document.createElement('div');
      achievementsGrid.className = 'achievements-grid';
      
      ACHIEVEMENTS.forEach(achievement => {
        const unlocked = profile.achievements.find(a => a.id === achievement.id);
        const achievementEl = document.createElement('div');
        achievementEl.className = `achievement-item ${unlocked ? 'unlocked' : 'locked'}`;
        achievementEl.innerHTML = `
          <div class="achievement-icon">${achievement.icon}</div>
          <div class="achievement-name">${achievement.name}</div>
          ${unlocked ? `<div class="achievement-date">Unlocked ${new Date(unlocked.unlockedAt).toLocaleDateString()}</div>` : ''}
        `;
        achievementEl.title = achievement.description;
        achievementsGrid.appendChild(achievementEl);
      });
      
      achievementsSection.appendChild(achievementsGrid);
      highScoresList.appendChild(achievementsSection);
      
      showModal(highScoresModal);
    }

    function showModal(modal) {
      modal.classList.add('active');
      setTimeout(() => {
        modal.querySelector('.modal-content').style.transform = 'scale(1)';
        modal.querySelector('.modal-content').style.opacity = '1';
      }, 50);
    }

    function hideModal(modal) {
      const content = modal.querySelector('.modal-content');
      content.style.transform = 'scale(0.8)';
      content.style.opacity = '0';
      setTimeout(() => {
        modal.classList.remove('active');
      }, 500);
    }

    function shareScore() {
      if (navigator.share) {
        navigator.share({
          title: 'Color Cascade',
          text: `I scored ${gameState.score} points in Color Cascade! Can you beat me?`,
          url: window.location.href
        }).catch(err => {
          console.error('Share failed:', err);
        });
      } else {
        alert(`I scored ${gameState.score} points in Color Cascade!`);
      }
    }

    function shuffleArray(array) {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
      return array;
    }

    function addPowerUp(tile) {
      const powerUpTypes = Object.keys(POWER_UPS);
      const randomType = powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];
      tile.dataset.powerUp = randomType;
      tile.classList.add('power-up');
      const tileContent = tile.querySelector('.tile-content');
      if (tileContent) {
        const powerUpIndicator = document.createElement('div');
        powerUpIndicator.className = 'power-up-indicator';
        powerUpIndicator.innerHTML = POWER_UPS[randomType].icon || '🎁';
        tileContent.appendChild(powerUpIndicator);
      }
      tile.addEventListener('mouseenter', showPowerUpTooltip);
      tile.addEventListener('mouseleave', hidePowerUpTooltip);
    }

    function showPowerUpTooltip(event) {
      // intentionally left empty
    }

    function hidePowerUpTooltip(event) {
      // intentionally left empty
    }

    function showPowerUpEffect(text) {
      // Get the notification area
      const notificationArea = document.getElementById('notification-area');
      
      // Remove any existing power-up effect
      document.querySelectorAll('.notification-message').forEach(el => el.remove());
      
      const effect = document.createElement('div');
      effect.className = 'notification-message';
      effect.textContent = text;
      notificationArea.appendChild(effect);
      
      setTimeout(() => {
        if (effect.parentNode) {
          effect.remove();
        }
      }, 2000);
      
      playSound('powerup');
    }

    // Create a single audio context that's reused for better mobile performance
    let audioContext = null;
    
    function initAudioContext() {
      if (!audioContext) {
        try {
          audioContext = new (window.AudioContext || window.webkitAudioContext)();
          // Resume context on user interaction for iOS
          if (audioContext.state === 'suspended') {
            document.addEventListener('click', () => {
              audioContext.resume();
            }, { once: true });
          }
        } catch (e) {
          console.log('Audio context not supported');
        }
      }
      return audioContext;
    }

    function playSound(type) {
      if (!gameState.soundEnabled) return;
      
      const sounds = {
        select: { frequency: 300, duration: 100 },
        match: { frequency: 500, duration: 150 },
        powerup: { frequency: 800, duration: 200 },
        levelup: { frequency: 600, duration: 300 },
        gameover: { frequency: 200, duration: 500 },
        bigCombo: { frequency: 1000, duration: 500 }
      };
      
      try {
        const context = initAudioContext();
        if (!context) return;
        
        // Resume context if it's suspended (common on mobile)
        if (context.state === 'suspended') {
          context.resume();
        }
        
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.value = sounds[type].frequency;
        oscillator.connect(gain);
        gain.connect(context.destination);
        
        // Start with 0 volume to avoid clicks
        gain.gain.setValueAtTime(0, context.currentTime);
        gain.gain.linearRampToValueAtTime(0.2, context.currentTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.01, context.currentTime + sounds[type].duration / 1000);
        
        oscillator.start(context.currentTime);
        oscillator.stop(context.currentTime + sounds[type].duration / 1000);
      } catch (e) {
        console.log('Sound playback error:', e);
      }
    }

    function toggleSound() {
      gameState.soundEnabled = !gameState.soundEnabled;
      return gameState.soundEnabled;
    }

    function forceEndAllCombos() {
      if (gameState.activeComboColor) {
        endCombo();
      }
      
      // Additional cleanup to ensure all combo elements are removed
      document.querySelectorAll('.tile-in-combo').forEach(tile => {
        tile.classList.remove('tile-in-combo');
      });
      
      document.querySelectorAll('.combo-trail').forEach(dot => {
        dot.remove();
      });
      
      if (gameState.comboTrails) {
        gameState.comboTrails = [];
      }
      
      clearAllSequenceMarkers();
      comboIndicator.classList.remove('active');
      document.getElementById('combo-timer').classList.remove('active');
    }

    function clearConnectionLines() {
      document.querySelectorAll('.connection-line:not(.combo-connection)').forEach(connection => {
        connection.remove();
      });
    }

    // 1. Add a function to clear all sequence markers
    function clearAllSequenceMarkers() {
      document.querySelectorAll('.combo-sequence-marker').forEach(marker => {
        if (marker.parentNode) {
          marker.remove();
        }
      });
    }

    // New function to add sequence numbers to tiles in a combo
    function addSequenceNumber(tile, number) {
      // Function now does nothing - effectively removing sequence numbers
      return;
    }

    // 3. Add a function to check if all tiles of a color are matched
    function checkAllColorTilesMatched(color) {
      // Count total tiles of this color
      const totalTilesOfColor = gameState.tiles.filter(t => 
        t.color === color && !t.matched
      ).length;
      
      // Count tiles of this color in the current combo
      const tilesInCombo = gameState.comboChain.length;
      
      console.log(`Color ${color}: ${tilesInCombo} in combo, ${totalTilesOfColor} total remaining`);
      
      // If all tiles of this color are in the combo, return true
      return tilesInCombo >= totalTilesOfColor;
    }

    // Add a new function to show an intro animation
    function showIntro() {
      // Create start screen
      const startScreen = document.createElement('div');
      startScreen.className = 'start-screen';
      
      const content = document.createElement('div');
      content.className = 'start-screen-content';
      
      // Create D3 animation container
      const d3Container = document.createElement('div');
      d3Container.className = 'd3-animation-container';
      startScreen.appendChild(d3Container);
      
      // Create logo area with D3 animation
      const logoArea = document.createElement('div');
      logoArea.className = 'game-logo';
      logoArea.id = 'd3-logo';
      
      const title = document.createElement('h1');
      title.className = 'start-title';
      title.textContent = 'Color Cascade';
      
      const subtitle = document.createElement('p');
      subtitle.className = 'start-subtitle';
      subtitle.textContent = 'Match colors • Create combos • Beat your high score';
      
      const startButton = document.createElement('button');
      startButton.className = 'start-button';
      startButton.textContent = 'Play Now';
      startButton.addEventListener('click', () => {
        startScreen.style.opacity = '0';
        setTimeout(() => {
          startScreen.remove();
          startGame();
        }, 500);
      });
      
      // Append elements in correct order
      content.appendChild(logoArea);
      content.appendChild(title);
      content.appendChild(subtitle);
      
      // Add player welcome message after title/subtitle
      const profile = PlayerProfile.load();
      if (profile.stats.gamesPlayed > 0) {
        const welcomeBack = document.createElement('div');
        welcomeBack.className = 'welcome-back';
        welcomeBack.innerHTML = `
          <p>Welcome back! You've played ${profile.stats.gamesPlayed} games</p>
          <p>Your best score: ${profile.stats.highestScore.toLocaleString()}</p>
        `;
        content.appendChild(welcomeBack);
      }
      
      content.appendChild(startButton);
      startScreen.appendChild(content);
      
      document.body.appendChild(startScreen);
      
      // Create D3 animations
      createD3StartAnimation(d3Container, logoArea);
    }
    
    // Create D3 animations for the start screen
    function createD3StartAnimation(container, logoArea) {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      // Create SVG for background animation
      const svg = d3.select(container)
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .style('position', 'absolute')
        .style('top', 0)
        .style('left', 0);
      
      // Create floating particles
      const particles = [];
      const particleCount = 50;
      
      for (let i = 0; i < particleCount; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          r: Math.random() * 15 + 5,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          vx: (Math.random() - 0.5) * 2,
          vy: (Math.random() - 0.5) * 2
        });
      }
      
      const particleElements = svg.selectAll('circle')
        .data(particles)
        .enter()
        .append('circle')
        .attr('cx', d => d.x)
        .attr('cy', d => d.y)
        .attr('r', 0)
        .attr('fill', d => d.color)
        .attr('opacity', 0.6)
        .style('filter', 'blur(2px)')
        .transition()
        .duration(1000)
        .attr('r', d => d.r);
      
      // Animate particles
      function animateParticles() {
        particles.forEach(p => {
          p.x += p.vx;
          p.y += p.vy;
          
          if (p.x < 0 || p.x > width) p.vx *= -1;
          if (p.y < 0 || p.y > height) p.vy *= -1;
        });
        
        svg.selectAll('circle')
          .data(particles)
          .attr('cx', d => d.x)
          .attr('cy', d => d.y);
        
        requestAnimationFrame(animateParticles);
      }
      
      animateParticles();
      
      // Create logo animation in the logo area
      const isMobile = window.innerWidth <= 768;
      const logoSize = isMobile ? 200 : 300;
      
      const logoSvg = d3.select(logoArea)
        .append('svg')
        .attr('width', logoSize)
        .attr('height', logoSize)
        .attr('viewBox', `0 0 ${logoSize} ${logoSize}`);
      
      // Create cascading tiles animation
      const tileSize = isMobile ? 25 : 35;
      const cols = 6;
      const rows = 6;
      const logoTiles = [];
      
      // Calculate centering offset
      const totalWidth = cols * tileSize;
      const totalHeight = rows * tileSize;
      const offsetX = (logoSize - totalWidth) / 2;
      const offsetY = (logoSize - totalHeight) / 2;
      
      for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
          const tile = {
            x: offsetX + j * tileSize,
            y: offsetY + i * tileSize,
            color: COLORS[(i + j) % COLORS.length],
            delay: (i + j) * 100
          };
          logoTiles.push(tile);
        }
      }
      
      logoSvg.selectAll('rect')
        .data(logoTiles)
        .enter()
        .append('rect')
        .attr('x', d => d.x)
        .attr('y', -50)
        .attr('width', tileSize - 8)
        .attr('height', tileSize - 8)
        .attr('rx', 6)
        .attr('fill', d => d.color)
        .attr('opacity', 0)
        .transition()
        .delay(d => d.delay)
        .duration(800)
        .attr('y', d => d.y)
        .attr('opacity', 0.6)
        .transition()
        .duration(2000)
        .attr('transform', function(d, i) {
          return `rotate(${Math.sin(i) * 5} ${d.x + tileSize/2} ${d.y + tileSize/2})`;
        });
      
      // Add pulsing animation to logo tiles
      setInterval(() => {
        logoSvg.selectAll('rect')
          .transition()
          .duration(1000)
          .attr('opacity', 0.4)
          .transition()
          .duration(1000)
          .attr('opacity', 0.8);
      }, 2000);
    }


    // New function to check if there's only one tile of each color left
    function isSingletonMode() {
      // Get all active (non-matched) tiles
      const activeTiles = gameState.tiles.filter(tile => !tile.matched);
      
      // If there are no tiles left, we're not in singleton mode
      if (activeTiles.length === 0) return false;
      
      // Count occurrences of each color
      const colorCounts = {};
      activeTiles.forEach(tile => {
        const color = tile.color;
        if (color) {
          if (!colorCounts[color]) {
            colorCounts[color] = 1;
          } else {
            colorCounts[color]++;
          }
        }
      });
      
      // Check if any color has more than one tile
      const multipleExists = Object.values(colorCounts).some(count => count > 1);
      
      // Singleton mode is when there's no color with multiple tiles
      const isSingleton = !multipleExists;
      
      if (isSingleton) {
        console.log("Singleton mode detected - only one tile of each color remains");
      }
      
      return isSingleton;
    }

    // Achievement checking functions
    function checkComboAchievements(comboLevel) {
      if (comboLevel >= 5 && PlayerProfile.addAchievement(ACHIEVEMENTS.find(a => a.id === 'combo_5'))) {
        showAchievementUnlocked('Combo Starter');
      }
      if (comboLevel >= 10 && PlayerProfile.addAchievement(ACHIEVEMENTS.find(a => a.id === 'combo_10'))) {
        showAchievementUnlocked('Combo Master');
      }
    }
    
    function checkScoreAchievements(score) {
      if (score >= 1000 && PlayerProfile.addAchievement(ACHIEVEMENTS.find(a => a.id === 'score_1000'))) {
        showAchievementUnlocked('Scorer');
      }
      if (score >= 5000 && PlayerProfile.addAchievement(ACHIEVEMENTS.find(a => a.id === 'score_5000'))) {
        showAchievementUnlocked('High Scorer');
      }
      if (score >= 10000 && PlayerProfile.addAchievement(ACHIEVEMENTS.find(a => a.id === 'score_10000'))) {
        showAchievementUnlocked('Master Scorer');
      }
    }
    
    function checkLevelAchievements(level) {
      if (level >= 10 && PlayerProfile.addAchievement(ACHIEVEMENTS.find(a => a.id === 'level_10'))) {
        showAchievementUnlocked('Climbing');
      }
      if (level >= 25 && PlayerProfile.addAchievement(ACHIEVEMENTS.find(a => a.id === 'level_25'))) {
        showAchievementUnlocked('Ascending');
      }
      if (level >= 50 && PlayerProfile.addAchievement(ACHIEVEMENTS.find(a => a.id === 'level_50'))) {
        showAchievementUnlocked('Summit');
      }
    }
    
    function showAchievementUnlocked(name) {
      const achievement = ACHIEVEMENTS.find(a => a.name === name);
      if (!achievement) return;
      
      const notificationArea = document.getElementById('notification-area');
      const achievementEl = document.createElement('div');
      achievementEl.className = 'achievement-unlocked';
      achievementEl.innerHTML = `
        <div class="achievement-icon">${achievement.icon}</div>
        <div class="achievement-info">
          <div class="achievement-title">Achievement Unlocked!</div>
          <div class="achievement-name">${achievement.name}</div>
          <div class="achievement-desc">${achievement.description}</div>
        </div>
      `;
      
      notificationArea.appendChild(achievementEl);
      
      setTimeout(() => {
        achievementEl.style.opacity = '0';
        setTimeout(() => achievementEl.remove(), 500);
      }, 4000);
      
      playSound('levelup');
    }

    document.addEventListener('DOMContentLoaded', initGame);

    // Function to automatically detect time of day and season
    function detectTimeAndSeason() {
      const now = new Date();
      const hour = now.getHours();
      const month = now.getMonth(); // 0-11
      
      // Detect time of day
      let timeTheme;
      if (hour >= 5 && hour < 12) {
        timeTheme = 'morning';
      } else if (hour >= 12 && hour < 17) {
        timeTheme = 'afternoon';
      } else if (hour >= 17 && hour < 21) {
        timeTheme = 'evening';
      } else {
        timeTheme = 'night';
      }
      
      // Detect season (Northern Hemisphere)
      let seasonTheme;
      if (month >= 2 && month < 5) {
        seasonTheme = 'spring';
      } else if (month >= 5 && month < 8) {
        seasonTheme = 'summer';
      } else if (month >= 8 && month < 11) {
        seasonTheme = 'autumn';
      } else {
        seasonTheme = 'winter';
      }
      
      console.log(`Auto-detected themes - Time: ${timeTheme}, Season: ${seasonTheme}`);
      return { timeTheme, seasonTheme };
    }

    function addPowerUpToTile(tile, powerUpType) {
      if (!POWER_UPS[powerUpType]) {
        console.error(`Power-up type not found: ${powerUpType}`);
        return;
      }
      
      tile.dataset.powerUp = powerUpType;
      tile.classList.add('power-up');
      
      // Create the indicator
      const indicator = document.createElement('div');
      indicator.className = 'power-up-indicator';
      indicator.textContent = POWER_UPS[powerUpType].icon;
      tile.appendChild(indicator);
      
      // Animate the indicator
      indicator.style.animation = 'pulse 1.5s infinite alternate';
      
      // Add tooltip events
      tile.addEventListener('mouseenter', showPowerUpTooltip);
      tile.addEventListener('mouseleave', hidePowerUpTooltip);
      
      console.log(`Added ${powerUpType} power-up to tile`);
    }

    // Update UI for displaying level difficulty
    function updateLevelDifficultyDisplay() {
      // Use the existing difficulty element
      const difficultyElement = document.getElementById('difficulty');
      if (!difficultyElement) return;
      
      // Calculate and display the difficulty
      const level = gameState.level;
      let difficulty;
      let difficultyClass = '';
      let difficultyPercent = 0;
      
      if (level <= 10) {
        difficulty = 'Novice';
        difficultyClass = 'difficulty-novice';
        difficultyPercent = Math.round((level / 10) * 20); // 0-20%
      } else if (level <= 20) {
        difficulty = 'Advanced';
        difficultyClass = 'difficulty-advanced';
        difficultyPercent = 20 + Math.round(((level - 10) / 10) * 20); // 20-40%
      } else if (level <= 35) {
        difficulty = 'Expert';
        difficultyClass = 'difficulty-expert';
        difficultyPercent = 40 + Math.round(((level - 20) / 15) * 20); // 40-60%
      } else if (level <= 50) {
        difficulty = 'Master';
        difficultyClass = 'difficulty-master';
        difficultyPercent = 60 + Math.round(((level - 35) / 15) * 20); // 60-80%
      } else if (level <= 75) {
        difficulty = 'Grandmaster';
        difficultyClass = 'difficulty-grandmaster';
        difficultyPercent = 80 + Math.round(((level - 50) / 25) * 15); // 80-95%
      } else {
        difficulty = 'Legendary';
        difficultyClass = 'difficulty-legendary';
        difficultyPercent = 95 + Math.min(5, Math.round((level - 75) / 5)); // 95-100%
      }
      
      // Get adaptive difficulty factor
      const profile = PlayerProfile.load();
      const performanceRatio = profile.stats.gamesPlayed > 0 ? 
        profile.stats.avgScore / (profile.stats.avgLevel * 100) : 1;
      const adaptiveFactor = Math.min(1.2, Math.max(0.8, performanceRatio));
      
      // Adjust percentage based on adaptive difficulty
      difficultyPercent = Math.min(100, Math.round(difficultyPercent * adaptiveFactor));
      
      // Update the display with both text and percentage
      difficultyElement.textContent = `${difficulty} (${difficultyPercent}%)`;
      
      // Remove any existing difficulty classes
      const classList = difficultyElement.classList;
      ['difficulty-novice', 'difficulty-advanced', 'difficulty-expert', 
       'difficulty-master', 'difficulty-grandmaster', 'difficulty-legendary'].forEach(cls => {
        classList.remove(cls);
      });
      
      // Add the appropriate class
      classList.add(difficultyClass);
    }

// 荒川区ポスティングナビ - メイン処理
// 全エリアデータを保存
let allAreaData = {};

/**
 * 現在のページがメインページかどうかを判定してパスを調整
 */
function getDataPath(filename) {
  const currentPath = window.location.pathname;
  if (currentPath.includes('/posting/')) {
    return `../data/${filename}`;
  } else {
    return `./data/${filename}`;
  }
}

/**
 * メインページ用のデータ取得関数（パス調整版）
 */
async function getPostingListForMain() {
  const postinglistResponse = await fetch(getDataPath('postinglist.json'));
  const postinglist = await postinglistResponse.json();
  return postinglist;
}

async function getPostingProgressForMain() {
  const progressResponse = await fetch(getDataPath('posting_progress.json'));
  const progress = await progressResponse.json();
  return progress;
}

/**
 * 進捗データを取得して表示を更新
 */
async function updateStats() {
  try {
    console.log('データ取得開始...');
    
    // メインページ用の関数を使用
    const areaList = await getPostingListForMain();
    const progress = await getPostingProgressForMain();
    
    console.log('取得したデータ:', { areaList, progress });
    
    // 全エリアデータを構築
    allAreaData = buildAreaData(areaList, progress);
    
    // 統計表示を更新
    let totalAreas = 0;
    let completedAreas = 0;
    
    Object.values(allAreaData).forEach(area => {
      totalAreas++;
      if (area.progress === 1.0) completedAreas++;
    });
    
    const progressRate = totalAreas > 0 ? (completedAreas / totalAreas) * 100 : 0;
    
    document.getElementById('totalAreas').textContent = totalAreas;
    document.getElementById('completedAreas').textContent = completedAreas;
    document.getElementById('progressRate').textContent = progressRate.toFixed(1) + '%';
    document.getElementById('progressBar').style.width = progressRate + '%';
    
    // 最終更新日時を設定
    document.getElementById('lastUpdate').textContent = new Date().toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    console.log('統計更新完了:', { totalAreas, completedAreas, progressRate });
    
  } catch (error) {
    console.error('進捗データの取得に失敗しました:', error);
    
    // エラー表示
    showError('データ取得エラー: ' + error.message);
    
    // エラー時はデフォルト値を表示
    document.getElementById('totalAreas').textContent = '51';
    document.getElementById('completedAreas').textContent = '0';
    document.getElementById('progressRate').textContent = '0.0%';
    
    // 空のダミーデータを作成（フィルター機能が動作するように）
    allAreaData = {};
  }
}

/**
 * エラー表示関数
 */
function showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'alert alert-warning alert-dismissible fade show';
  errorDiv.style.position = 'fixed';
  errorDiv.style.top = '20px';
  errorDiv.style.right = '20px';
  errorDiv.style.zIndex = '9999';
  errorDiv.style.maxWidth = '400px';
  errorDiv.innerHTML = `
    <i class="fas fa-exclamation-triangle me-2"></i>
    <strong>注意:</strong> ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;
  
  document.body.appendChild(errorDiv);
  
  // 10秒後に自動で消す
  setTimeout(() => {
    if (errorDiv.parentNode) {
      errorDiv.remove();
    }
  }, 10000);
}

/**
 * エリアデータを構築
 */
function buildAreaData(areaList, progress) {
  const areaData = {};
  
  for (let [key, areaInfo] of Object.entries(areaList)) {
    let cho_max_number = Number(areaInfo['area_cho_max_number']);
    
    for(let cho_index = 0; cho_index < cho_max_number; cho_index++){
      let cho_number = cho_index + 1;
      const progressIndex = cho_max_number === 1 ? 0 : cho_index;
      
      const areaName = cho_max_number === 1 ? 
        areaInfo['area_name'] : 
        `${areaInfo['area_name']}${cho_number}丁目`;
      
      const progressValue = progress[key] ? progress[key]["progresses"][progressIndex] : 0;
      const executer = progress[key] ? progress[key]["executer"][progressIndex] : '未割当';
      const postingDate = progress[key] ? progress[key]["posting_date"][progressIndex] : '未定';
      
      areaData[areaName] = {
        name: areaName,
        progress: progressValue,
        executer: executer,
        postingDate: postingDate,
        isWorking: progress[key] ? progress[key]["is_working"][progressIndex] : false
      };
    }
  }
  
  return areaData;
}

/**
 * エリアリストを表示
 */
function displayAreaList(filter) {
  const container = document.getElementById('areaListContainer');
  
  // フィルターに応じてエリアを抽出
  let filteredAreas = [];
  
  Object.values(allAreaData).forEach(area => {
    switch(filter) {
      case 'not-started':
        if (area.progress === 0) filteredAreas.push(area);
        break;
      case 'in-progress':
        if (area.progress > 0 && area.progress < 1.0) filteredAreas.push(area);
        break;
      case 'completed':
        if (area.progress === 1.0) filteredAreas.push(area);
        break;
      default: // 'all'
        filteredAreas.push(area);
    }
  });

  // エリア名でソート
  filteredAreas.sort((a, b) => a.name.localeCompare(b.name, 'ja'));

  if (filteredAreas.length === 0) {
    container.innerHTML = `
      <div class="text-muted text-center py-4">
        <i class="fas fa-search me-2"></i>
        該当するエリアがありません
      </div>
    `;
    return;
  }

  // ヘッダー部分
  let html = `
    <div class="area-count">
      <i class="fas fa-map-marker-alt me-2"></i>
      ${filteredAreas.length}件のエリア
    </div>
    <div class="area-list">
  `;

  // エリアリスト
  filteredAreas.forEach(area => {
    const progressPercent = (area.progress * 100).toFixed(1);
    let badgeClass = 'not-started';
    let badgeText = `${progressPercent}%`;
    
    if (area.progress === 0) {
      badgeClass = 'not-started';
      badgeText = '未着手';
    } else if (area.progress < 1.0) {
      badgeClass = 'in-progress';
      badgeText = `${progressPercent}%`;
    } else {
      badgeClass = 'completed';
      badgeText = '完了';
    }

    html += `
      <div class="area-item">
        <div class="area-content">
          <div class="area-name">${area.name}</div>
          <div class="area-details">
            担当: ${area.executer}<br>
            投函日: ${area.postingDate}
          </div>
        </div>
        <div class="progress-badge ${badgeClass}">
          ${badgeText}
        </div>
      </div>
    `;
  });

  html += '</div>';
  container.innerHTML = html;
}

/**
 * フィルターボタンのイベントリスナーを設定
 */
function initializeFilterButtons() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      // アクティブ状態を切り替え
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      
      const filter = this.dataset.filter;
      
      // エリアリストを表示
      displayAreaList(filter);
      
      // フィルター情報をローカルストレージに保存（地図ページで使用）
      localStorage.setItem('progressFilter', filter);
    });
  });
}

/**
 * 保存されたフィルター状態を復元
 */
function restoreSavedFilter() {
  const savedFilter = localStorage.getItem('progressFilter');
  if (savedFilter && savedFilter !== 'all') {
    const filterBtn = document.querySelector(`[data-filter="${savedFilter}"]`);
    if (filterBtn) {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      filterBtn.classList.add('active');
      // 少し遅延させてデータ読み込み後に実行
      setTimeout(() => displayAreaList(savedFilter), 500);
    }
  }
}

/**
 * アプリケーション初期化
 */
function initializeApp() {
  // フィルターボタンの初期化
  initializeFilterButtons();
  
  // データ取得と表示更新
  updateStats().then(() => {
    // 初期表示（すべて表示）
    displayAreaList('all');
    
    // 保存されたフィルターの復元
    restoreSavedFilter();
  });
}

// DOMコンテンツ読み込み完了時に初期化実行
document.addEventListener('DOMContentLoaded', initializeApp);
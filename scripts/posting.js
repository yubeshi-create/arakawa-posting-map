const map = L.map("map", {
  // ピンチローテーション機能を有効化
  touchRotate: true,
  rotateControl: {
    closeOnZeroBearing: false
  }
}).setView([35.7362, 139.7831], 13);　　　// 中心は荒川区

// 背景地図はOpenStreetMap
const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Linked Open Addresses Japan',
}).addTo(map);

// 現在地関連の変数
let currentLocationMarker = null;
let watchPositionId = null;
let accuracyCircle = null;

// 現在地アイコンの定義
const currentLocationIcon = L.icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="blue" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <circle cx="12" cy="12" r="3" fill="blue"/>
    </svg>
  `),
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -12]
});

// 地図サイズを動的に調整する関数
function adjustMapSize() {
  const mapContainer = map.getContainer();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  // 回転時の対角線を考慮したサイズ計算
  // √2 ≈ 1.414（45度回転で最大となる対角線の比率）
  const diagonal = Math.sqrt(viewportWidth * viewportWidth + viewportHeight * viewportHeight);
  const extraSize = diagonal * 0.2; // 20%のマージンを追加
  
  mapContainer.style.width = `${diagonal + extraSize}px`;
  mapContainer.style.height = `${diagonal + extraSize}px`;
  
  // 中央配置のためのオフセット計算
  const offsetX = (diagonal + extraSize - viewportWidth) / 2;
  const offsetY = (diagonal + extraSize - viewportHeight) / 2;
  
  mapContainer.style.left = `-${offsetX}px`;
  mapContainer.style.top = `-${offsetY}px`;
  
  console.log(`地図サイズ調整: ${diagonal + extraSize}px x ${diagonal + extraSize}px`);
}

// カスタムタッチ回転ハンドラー（改良版）
let touchRotateHandler = {
  startAngle: 0,
  currentRotation: 0,
  isRotating: false,
  
  enable: function() {
    map.getContainer().addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
    map.getContainer().addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
    map.getContainer().addEventListener('touchend', this.onTouchEnd.bind(this), { passive: false });
    
    // 初期サイズ調整
    adjustMapSize();
    
    // ウィンドウリサイズ時の再調整
    window.addEventListener('resize', adjustMapSize);
    window.addEventListener('orientationchange', () => {
      setTimeout(adjustMapSize, 100); // 少し遅延させて確実に実行
    });
  },
  
  onTouchStart: function(e) {
    if (e.touches.length === 2) {
      this.startAngle = this.getAngle(e.touches[0], e.touches[1]);
      this.isRotating = true;
      e.preventDefault();
    }
  },
  
  onTouchMove: function(e) {
    if (e.touches.length === 2 && this.isRotating) {
      const currentAngle = this.getAngle(e.touches[0], e.touches[1]);
      let deltaAngle = currentAngle - this.startAngle;
      
      // 角度の正規化（-180～180度の範囲に収める）
      if (deltaAngle > 180) deltaAngle -= 360;
      if (deltaAngle < -180) deltaAngle += 360;
      
      // 回転角度を更新（感度調整）
      this.currentRotation += deltaAngle * 0.8; // 感度を80%に調整
      this.applyRotation(this.currentRotation);
      
      this.startAngle = currentAngle;
      e.preventDefault();
    }
  },
  
  onTouchEnd: function(e) {
    if (e.touches.length < 2) {
      this.isRotating = false;
    }
  },
  
  getAngle: function(touch1, touch2) {
    const deltaY = touch2.clientY - touch1.clientY;
    const deltaX = touch2.clientX - touch1.clientX;
    return Math.atan2(deltaY, deltaX) * (180 / Math.PI);
  },
  
  applyRotation: function(angle) {
    const mapContainer = map.getContainer();
    
    // 角度を正規化
    const normalizedAngle = ((angle % 360) + 360) % 360;
    
    mapContainer.style.transform = `rotate(${normalizedAngle}deg)`;
    mapContainer.style.transformOrigin = 'center center';
    
    // スムーズな遷移
    mapContainer.style.transition = 'transform 0.1s ease-out';
    
    console.log(`地図回転: ${normalizedAngle.toFixed(1)}度`);
  },
  
  reset: function() {
    this.currentRotation = 0;
    const mapContainer = map.getContainer();
    
    // スムーズなリセットアニメーション
    mapContainer.style.transition = 'transform 0.3s ease-out';
    mapContainer.style.transform = 'rotate(0deg)';
    
    // アニメーション完了後にtransitionを削除
    setTimeout(() => {
      mapContainer.style.transition = '';
    }, 300);
    
    console.log('地図回転リセット');
  }
};

// タッチ回転を有効化
touchRotateHandler.enable();

// 位置情報サポートチェック
function checkGeolocationSupport() {
  if (!navigator.geolocation) {
    console.error('このブラウザは位置情報をサポートしていません');
    return false;
  }
  
  // HTTPS チェック
  if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
    console.warn('位置情報はHTTPS接続が必要です。現在のプロトコル:', location.protocol);
    alert('位置情報機能を使用するには、HTTPS接続が必要です。\nGitHub Pagesは自動的にHTTPSになるはずですが、確認してください。');
    return false;
  }
  
  return true;
}

// 現在地・リセットボタンのみのコントロール
const locationControl = L.Control.extend({
  onAdd: function(map) {
    const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
    
    // 現在地ボタン
    const locationBtn = L.DomUtil.create('button', '', container);
    locationBtn.innerHTML = '📍';
    locationBtn.style.backgroundColor = 'white';
    locationBtn.style.border = '2px solid rgba(0,0,0,0.2)';
    locationBtn.style.width = '50px';
    locationBtn.style.height = '50px';
    locationBtn.style.fontSize = '20px';
    locationBtn.style.cursor = 'pointer';
    locationBtn.style.display = 'block';
    locationBtn.style.marginBottom = '5px';
    locationBtn.style.borderRadius = '4px';
    locationBtn.title = '現在地を表示';
    
    // 現在地追跡ボタン
    const trackBtn = L.DomUtil.create('button', '', container);
    trackBtn.innerHTML = '🎯';
    trackBtn.style.backgroundColor = 'white';
    trackBtn.style.border = '2px solid rgba(0,0,0,0.2)';
    trackBtn.style.width = '50px';
    trackBtn.style.height = '50px';
    trackBtn.style.fontSize = '20px';
    trackBtn.style.cursor = 'pointer';
    trackBtn.style.display = 'block';
    trackBtn.style.marginBottom = '5px';
    trackBtn.style.borderRadius = '4px';
    trackBtn.title = '現在地を追跡';
    
    // リセットボタン
    const resetBtn = L.DomUtil.create('button', '', container);
    resetBtn.innerHTML = '⚹';
    resetBtn.style.backgroundColor = 'white';
    resetBtn.style.border = '2px solid rgba(0,0,0,0.2)';
    resetBtn.style.width = '50px';
    resetBtn.style.height = '50px';
    resetBtn.style.fontSize = '20px';
    resetBtn.style.cursor = 'pointer';
    resetBtn.style.display = 'block';
    resetBtn.style.borderRadius = '4px';
    resetBtn.title = '北を上に戻す';
    
    // イベントリスナー
    locationBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      getCurrentLocation();
    });
    
    trackBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      toggleLocationTracking();
    });
    
    resetBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      touchRotateHandler.reset();
    });
    
    return container;
  },
  
  onRemove: function(map) {
    if (watchPositionId) {
      navigator.geolocation.clearWatch(watchPositionId);
    }
    window.removeEventListener('resize', adjustMapSize);
  }
});

// 現在地を取得して表示
function getCurrentLocation() {
  if (!checkGeolocationSupport()) {
    return;
  }
  
  console.log('現在地を取得中...');
  
  // 位置情報許可の確認
  navigator.permissions.query({name: 'geolocation'}).then(function(permissionStatus) {
    console.log('位置情報許可状態:', permissionStatus.state);
    
    if (permissionStatus.state === 'denied') {
      alert('位置情報が拒否されています。\n\nブラウザの設定で位置情報を許可してください：\n\n1. ブラウザの設定を開く\n2. プライバシーとセキュリティ\n3. サイト設定\n4. 位置情報\n5. このサイトを許可に変更');
      return;
    }
  }).catch(function() {
    console.log('Permissions API not supported');
  });
  
  navigator.geolocation.getCurrentPosition(
    function(position) {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const accuracy = position.coords.accuracy;
      
      console.log(`現在地取得成功: ${lat}, ${lng} (誤差: ${accuracy}m)`);
      
      // 既存のマーカーと円を削除
      if (currentLocationMarker) {
        map.removeLayer(currentLocationMarker);
      }
      if (accuracyCircle) {
        map.removeLayer(accuracyCircle);
      }
      
      // 現在地マーカーを追加
      currentLocationMarker = L.marker([lat, lng], {
        icon: currentLocationIcon
      }).addTo(map);
      
      currentLocationMarker.bindPopup(`
        <b>📍 現在地</b><br>
        緯度: ${lat.toFixed(6)}<br>
        経度: ${lng.toFixed(6)}<br>
        精度: ${accuracy.toFixed(0)}m<br>
        <small>取得時刻: ${new Date().toLocaleTimeString()}</small>
      `);
      
      // 現在地を中心に移動
      map.setView([lat, lng], 17);
      
      // 精度範囲の円を表示
      accuracyCircle = L.circle([lat, lng], {
        radius: Math.min(accuracy, 100), // 最大100mに制限
        color: 'blue',
        fillColor: 'lightblue',
        fillOpacity: 0.1,
        weight: 1
      }).addTo(map);
      
    },
    function(error) {
      console.error('位置情報取得エラー:', error);
      
      let errorMessage = '';
      switch(error.code) {
        case error.PERMISSION_DENIED:
          errorMessage = '位置情報の利用が拒否されました。\n\nブラウザの設定で位置情報を許可してください。\n\n【設定方法】\n1. アドレスバーの左の🔒マークをタップ\n2. 位置情報を「許可」に変更\n3. ページを再読み込み';
          break;
        case error.POSITION_UNAVAILABLE:
          errorMessage = '位置情報を取得できませんでした。\n\n・GPS信号が弱い可能性があります\n・屋外で再試行してください\n・機内モードがオフか確認してください';
          break;
        case error.TIMEOUT:
          errorMessage = '位置情報の取得がタイムアウトしました。\n\n・しばらく待ってから再試行してください\n・GPS信号の良い場所に移動してください';
          break;
        default:
          errorMessage = '位置情報の取得中にエラーが発生しました。\n\nページを再読み込みして再試行してください。';
          break;
      }
      
      alert(errorMessage);
    },
    {
      enableHighAccuracy: true,    // 高精度モード
      timeout: 15000,             // 15秒でタイムアウト
      maximumAge: 60000           // キャッシュを1分間使用
    }
  );
}

// 現在地追跡の開始/停止
function toggleLocationTracking() {
  if (watchPositionId) {
    // 追跡停止
    navigator.geolocation.clearWatch(watchPositionId);
    watchPositionId = null;
    console.log('現在地追跡を停止');
    
    const trackBtn = document.querySelector('[title="現在地を追跡"]');
    if (trackBtn) {
      trackBtn.style.backgroundColor = 'white';
    }
  } else {
    // 追跡開始
    if (!checkGeolocationSupport()) {
      return;
    }
    
    console.log('現在地追跡を開始');
    
    watchPositionId = navigator.geolocation.watchPosition(
      function(position) {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracy = position.coords.accuracy;
        
        // マーカー更新
        if (currentLocationMarker) {
          map.removeLayer(currentLocationMarker);
        }
        if (accuracyCircle) {
          map.removeLayer(accuracyCircle);
        }
        
        currentLocationMarker = L.marker([lat, lng], {
          icon: currentLocationIcon
        }).addTo(map);
        
        currentLocationMarker.bindPopup(`
          <b>📍 現在地（追跡中）</b><br>
          緯度: ${lat.toFixed(6)}<br>
          経度: ${lng.toFixed(6)}<br>
          精度: ${accuracy.toFixed(0)}m<br>
          <small>更新: ${new Date().toLocaleTimeString()}</small>
        `);
        
        accuracyCircle = L.circle([lat, lng], {
          radius: Math.min(accuracy, 50),
          color: 'blue',
          fillColor: 'lightblue', 
          fillOpacity: 0.1,
          weight: 1
        }).addTo(map);
        
        // 地図の中心を現在地に移動
        map.setView([lat, lng], map.getZoom());
        
        console.log(`現在地更新: ${lat}, ${lng}`);
      },
      function(error) {
        console.error('位置情報追跡エラー:', error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000    // 5秒間キャッシュ
      }
    );
    
    const trackBtn = document.querySelector('[title="現在地を追跡"]');
    if (trackBtn) {
      trackBtn.style.backgroundColor = 'lightblue';
    }
  }
}

// コントロールを地図に追加
map.addControl(new locationControl({ position: 'topleft' }));

// 初期化完了メッセージ
setTimeout(() => {
  console.log('📱 荒川区ポスティングマップ（回転余白修正版）');
  console.log('• 2本指で地図を回転（余白なし）');
  console.log('• 📍 現在地を表示');  
  console.log('• 🎯 現在地を追跡');
  console.log('• ⚹ 北を上に戻す');
}, 1000);

// 以下は既存のコード（凡例、色分け、データ読み込み）
function legend() {
  var control = L.control({position: 'topright'});
  control.onAdd = function () {
      var div = L.DomUtil.create('div', 'info legend')
      grades = [1, 0.75, 0.5, 0.25, 0]

      div.innerHTML += '<p>凡例</p>';

      var legendInnerContainerDiv = L.DomUtil.create('div', 'legend-inner-container', div);
      legendInnerContainerDiv.innerHTML += '<div class="legend-gradient"></div>';

      var labelsDiv = L.DomUtil.create('div', 'legend-labels', legendInnerContainerDiv);
      for (var i = 0; i < grades.length; i++) {
        labelsDiv.innerHTML += '<span>' + grades[i] * 100 + '%</span>';
      }
      labelsDiv.innerHTML += '<span>投函予定</span>'
      return div;
  };

  return control
}

function getProgressColor(percentage) {
    const colorStops = [
        { pct: 0.0, color: { r: 227, g: 250, b: 254 } }, // #E3FAFE
        { pct: 0.25, color: { r: 210, g: 237, b: 253 } }, // #D2EDFD
        { pct: 0.5, color: { r: 115, g: 197, b: 251 } }, // #73C5FB
        { pct: 0.75, color: { r: 66, g: 176, b: 250 } }, // #42B0FA
        { pct: 0.999, color: { r: 12, g: 153, b: 247 } }, // #0C99F7
        { pct: 1.0, color: { r: 4, g: 97, b: 159 } } // #04619F
    ];

    percentage = Math.max(0, Math.min(1, percentage));

    let lower = colorStops[0];
    let upper = colorStops[colorStops.length - 1];

    for (let i = 1; i < colorStops.length; i++) {
        if (percentage <= colorStops[i].pct) {
            upper = colorStops[i];
            lower = colorStops[i - 1];
            break;
        }
    }

    const rangePct = (percentage - lower.pct) / (upper.pct - lower.pct);
    const r = Math.round(lower.color.r + rangePct * (upper.color.r - lower.color.r));
    const g = Math.round(lower.color.g + rangePct * (upper.color.g - lower.color.g));
    const b = Math.round(lower.color.b + rangePct * (upper.color.b - lower.color.b));

    return `rgb(${r}, ${g}, ${b})`;
}

function getGeoJsonStyle(progress) {
  return {
    color: 'black',
    fillColor: getProgressColor(progress),
    fillOpacity: 0.7,
    weight: 2,
  }
}

function getGeoJsonStyleIsWorking(){
    return {
    color: 'black',
    fillColor: `rgb(255, 214, 102)`,
    fillOpacity: 0.7,
    weight: 2,  
  }
}

let areaList;
let progress;

console.log('荒川区ポスティングマップ読み込み開始（回転余白修正版）');

Promise.all([getPostingList(), getPostingProgress()]).then(function(res) {
  areaList = res[0];
  progress = res[1];
  
  console.log('データ読み込み完了:', areaList, progress);
  
  // 総進捗率を自動計算
  let totalAreas = 0;
  let completedAreas = 0;
  
  for (let [key, data] of Object.entries(progress)) {
    if (key === 'total') continue;
    
    data.progresses.forEach(progressValue => {
      totalAreas++;
      if (progressValue === 1.0) completedAreas++;
    });
  }
  
  progress.total = totalAreas > 0 ? (completedAreas / totalAreas) : 0;
  console.log(`総進捗率: ${(progress.total * 100).toFixed(2)}%`);

  for (let [key, areaInfo] of Object.entries(areaList)) {
    console.log(`処理中: ${areaInfo['area_name']}`);
    let cho_max_number = Number(areaInfo['area_cho_max_number']);

    for(let cho_index = 0; cho_index < cho_max_number; cho_index++){
      let cho_number = cho_index + 1;
      let geoJsonUrl;
      
      if(cho_max_number === 1){
        geoJsonUrl = `https://uedayou.net/loa/東京都荒川区${areaInfo['area_name']}.geojson`;
      } else {
        geoJsonUrl = `https://uedayou.net/loa/東京都荒川区${areaInfo['area_name']}${cho_number}丁目.geojson`;
      }
      
      console.log(`GeoJSON取得: ${geoJsonUrl}`);
      
      fetch(geoJsonUrl)
        .then((response) => {
          if (!response.ok) {
            console.error(`GeoJSON取得失敗: ${geoJsonUrl} (${response.status})`);
            throw new Error(`Failed to fetch geojson for ${areaInfo['area_name']}`);
          }
          console.log(`GeoJSON取得成功: ${geoJsonUrl}`);
          return response.json();
        })
        .then((data) => {
          console.log(`GeoJSONデータ:`, data);
          
          const progressIndex = cho_max_number === 1 ? 0 : cho_index;
          const isWorking = progress[key]["is_working"][progressIndex];
          const progressValue = progress[key]["progresses"][progressIndex];
          
          const polygon = L.geoJSON(data, {
            style: isWorking ? getGeoJsonStyleIsWorking() : getGeoJsonStyle(progressValue),
          });
          
          const areaName = cho_max_number === 1 ? areaInfo['area_name'] : `${areaInfo['area_name']}${cho_number}丁目`;
          const popupContent = `<b>${areaName}</b><br>ポスティング進捗: ${(progressValue * 100).toFixed(1)}%<br>担当:${progress[key]["executer"][progressIndex]}<br>実施日:${progress[key]["posting_date"][progressIndex]}<br>備考:${progress[key]["notes"][progressIndex]}`;
          
          polygon.bindPopup(popupContent);
          polygon.addTo(map);
          
          console.log(`地図に追加完了: ${areaName}`);
        })
        .catch((error) => {
          console.error('GeoJSON処理エラー:', error);
        });
    }
  }
  
  progressBox((progress.total * 100).toFixed(2), 'topright').addTo(map);
  legend().addTo(map);
  
}).catch((error) => {
  console.error('データ読み込みエラー:', error);

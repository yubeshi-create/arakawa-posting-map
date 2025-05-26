const map = L.map("map").setView([35.7362, 139.7831], 13); // 中心は荒川区

// 背景地図はOpenStreetMap
const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Linked Open Addresses Japan',
}).addTo(map);

// 地図回転機能を追加
let currentRotation = 0;
let currentLocationMarker = null;
let watchPositionId = null;

// 現在地アイコンの定義
const currentLocationIcon = L.icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="blue" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  `),
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -12]
});

// 回転・現在地ボタンを追加
const controlButtons = L.Control.extend({
  onAdd: function(map) {
    const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
    
    // 現在地ボタン（最上部）
    const locationBtn = L.DomUtil.create('button', '', container);
    locationBtn.innerHTML = '📍';
    locationBtn.style.backgroundColor = 'white';
    locationBtn.style.border = '2px solid rgba(0,0,0,0.2)';
    locationBtn.style.width = '40px';
    locationBtn.style.height = '40px';
    locationBtn.style.fontSize = '16px';
    locationBtn.style.cursor = 'pointer';
    locationBtn.style.display = 'block';
    locationBtn.title = '現在地を表示';
    
    // 現在地追跡ボタン
    const trackBtn = L.DomUtil.create('button', '', container);
    trackBtn.innerHTML = '🎯';
    trackBtn.style.backgroundColor = 'white';
    trackBtn.style.border = '2px solid rgba(0,0,0,0.2)';
    trackBtn.style.width = '40px';
    trackBtn.style.height = '40px';
    trackBtn.style.fontSize = '16px';
    trackBtn.style.cursor = 'pointer';
    trackBtn.style.display = 'block';
    trackBtn.title = '現在地を追跡';
    
    // 左回転ボタン
    const leftBtn = L.DomUtil.create('button', '', container);
    leftBtn.innerHTML = '↺';
    leftBtn.style.backgroundColor = 'white';
    leftBtn.style.border = '2px solid rgba(0,0,0,0.2)';
    leftBtn.style.width = '40px';
    leftBtn.style.height = '40px';
    leftBtn.style.fontSize = '18px';
    leftBtn.style.cursor = 'pointer';
    leftBtn.style.display = 'block';
    leftBtn.title = '左回転';
    
    // 右回転ボタン
    const rightBtn = L.DomUtil.create('button', '', container);
    rightBtn.innerHTML = '↻';
    rightBtn.style.backgroundColor = 'white';
    rightBtn.style.border = '2px solid rgba(0,0,0,0.2)';
    rightBtn.style.width = '40px';
    rightBtn.style.height = '40px';
    rightBtn.style.fontSize = '18px';
    rightBtn.style.cursor = 'pointer';
    rightBtn.style.display = 'block';
    rightBtn.title = '右回転';
    
    // リセットボタン
    const resetBtn = L.DomUtil.create('button', '', container);
    resetBtn.innerHTML = '⚹';
    resetBtn.style.backgroundColor = 'white';
    resetBtn.style.border = '2px solid rgba(0,0,0,0.2)';
    resetBtn.style.width = '40px';
    resetBtn.style.height = '40px';
    resetBtn.style.fontSize = '18px';
    resetBtn.style.cursor = 'pointer';
    resetBtn.style.display = 'block';
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
    
    leftBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      rotateMap(-45);
    });
    
    rightBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      rotateMap(45);
    });
    
    resetBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      resetRotation();
    });
    
    return container;
  },
  
  onRemove: function(map) {
    if (watchPositionId) {
      navigator.geolocation.clearWatch(watchPositionId);
    }
  }
});

// 現在地を取得して表示
function getCurrentLocation() {
  if (!navigator.geolocation) {
    alert('このブラウザでは位置情報がサポートされていません');
    return;
  }
  
  console.log('現在地を取得中...');
  
  navigator.geolocation.getCurrentPosition(
    function(position) {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const accuracy = position.coords.accuracy;
      
      console.log(`現在地: ${lat}, ${lng} (誤差: ${accuracy}m)`);
      
      // 既存のマーカーを削除
      if (currentLocationMarker) {
        map.removeLayer(currentLocationMarker);
      }
      
      // 現在地マーカーを追加
      currentLocationMarker = L.marker([lat, lng], {
        icon: currentLocationIcon
      }).addTo(map);
      
      currentLocationMarker.bindPopup(`
        <b>📍 現在地</b><br>
        緯度: ${lat.toFixed(6)}<br>
        経度: ${lng.toFixed(6)}<br>
        精度: ${accuracy.toFixed(0)}m
      `);
      
      // 現在地を中心に移動
      map.setView([lat, lng], 16);
      
      // 現在地周辺の円を表示（精度範囲）
      L.circle([lat, lng], {
        radius: accuracy,
        color: 'blue',
        fillColor: 'lightblue',
        fillOpacity: 0.2,
        weight: 2
      }).addTo(map);
      
    },
    function(error) {
      console.error('位置情報取得エラー:', error);
      switch(error.code) {
        case error.PERMISSION_DENIED:
          alert('位置情報の利用が拒否されました。ブラウザの設定を確認してください。');
          break;
        case error.POSITION_UNAVAILABLE:
          alert('位置情報を取得できませんでした。');
          break;
        case error.TIMEOUT:
          alert('位置情報の取得がタイムアウトしました。');
          break;
        default:
          alert('位置情報の取得中にエラーが発生しました。');
          break;
      }
    },
    {
      enableHighAccuracy: true,  // 高精度モード
      timeout: 10000,           // 10秒でタイムアウト
      maximumAge: 60000         // キャッシュを1分間使用
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
    
    // ボタンの色を元に戻す
    const trackBtn = document.querySelector('[title="現在地を追跡"]');
    if (trackBtn) {
      trackBtn.style.backgroundColor = 'white';
    }
  } else {
    // 追跡開始
    if (!navigator.geolocation) {
      alert('このブラウザでは位置情報がサポートされていません');
      return;
    }
    
    console.log('現在地追跡を開始');
    
    watchPositionId = navigator.geolocation.watchPosition(
      function(position) {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        
        // 既存のマーカーを削除
        if (currentLocationMarker) {
          map.removeLayer(currentLocationMarker);
        }
        
        // 現在地マーカーを更新
        currentLocationMarker = L.marker([lat, lng], {
          icon: currentLocationIcon
        }).addTo(map);
        
        currentLocationMarker.bindPopup(`
          <b>📍 現在地（追跡中）</b><br>
          緯度: ${lat.toFixed(6)}<br>
          経度: ${lng.toFixed(6)}
        `);
        
        // 地図の中心を現在地に移動
        map.setView([lat, lng], map.getZoom());
        
        console.log(`現在地更新: ${lat}, ${lng}`);
      },
      function(error) {
        console.error('位置情報追跡エラー:', error);
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 30000
      }
    );
    
    // ボタンの色を変更（追跡中表示）
    const trackBtn = document.querySelector('[title="現在地を追跡"]');
    if (trackBtn) {
      trackBtn.style.backgroundColor = 'lightblue';
    }
  }
}

// 地図回転関数
function rotateMap(degrees) {
  currentRotation += degrees;
  if (currentRotation >= 360) currentRotation -= 360;
  if (currentRotation < 0) currentRotation += 360;
  
  const mapContainer = map.getContainer();
  mapContainer.style.transform = `rotate(${currentRotation}deg)`;
  mapContainer.style.transformOrigin = 'center';
  
  console.log(`地図回転: ${currentRotation}度`);
}

// 回転リセット関数
function resetRotation() {
  currentRotation = 0;
  const mapContainer = map.getContainer();
  mapContainer.style.transform = 'rotate(0deg)';
  console.log('地図回転リセット');
}

// コントロールを地図に追加
map.addControl(new controlButtons({ position: 'topleft' }));

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

console.log('荒川区ポスティングマップ読み込み開始（現在地・回転機能付き）');

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
      
      // 丁がない場合
      if(cho_max_number === 1){
        geoJsonUrl = `https://uedayou.net/loa/東京都荒川区${areaInfo['area_name']}.geojson`;
      } else {
        // 丁が1丁目2丁目・・・とある場合
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
});

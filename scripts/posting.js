const map = L.map("map").setView([35.7362, 139.7831], 13);　// 中心は荒川区

const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Linked Open Addresses Japan',
}).addTo(map);

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
        { pct: 0.0, color: { r: 227, g: 250, b: 254 } },
        { pct: 0.25, color: { r: 210, g: 237, b: 253 } },
        { pct: 0.5, color: { r: 115, g: 197, b: 251 } },
        { pct: 0.75, color: { r: 66, g: 176, b: 250 } },
        { pct: 0.999, color: { r: 12, g: 153, b: 247 } },
        { pct: 1.0, color: { r: 4, g: 97, b: 159 } }
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

Promise.all([getPostingList(), getPostingProgress()]).then(function(res) {
  areaList = res[0];
  progress = res[1];
  
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

  for (let [key, areaInfo] of Object.entries(areaList)) {
    let cho_max_number = Number(areaInfo['area_cho_max_number']);

    for(let cho_index = 0; cho_index < cho_max_number; cho_index++){
      let cho_number = cho_index + 1;
      let geoJsonUrl;
      
      if(cho_max_number === 1){
        geoJsonUrl = `https://uedayou.net/loa/東京都荒川区${areaInfo['area_name']}.geojson`;
      } else {
        geoJsonUrl = `https://uedayou.net/loa/東京都荒川区${areaInfo['area_name']}${cho_number}丁目.geojson`;
      }
      
      fetch(geoJsonUrl)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Failed to fetch geojson for ${areaInfo['area_name']}`);
          }
          return response.json();
        })
        .then((data) => {
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

import * as helper from "./helper";

//Status: 1 = watching | 2 = completed | 3 = onhold | 4 = dropped | 6 = plan to watch | 7 = all
export async function userList(status = 1, localListType = 'anime', callbacks, username: null|string = null, offset = 0, templist = []){
    status = parseInt(status.toString());
    var statusPart = '';
    if(status !== 7){
      status = helper.translateList(status, status);
      statusPart = '&filter[status]='+status;
    }

    username = await helper.userId();
    con.log('[UserList][Kitsu]', 'user: '+username, 'status: '+status, 'offset: '+offset);


    return api.request.xhr('GET', {
      url: 'https://kitsu.io/api/edge/library-entries?filter[user_id]='+await helper.userId()+statusPart+'&filter[kind]='+localListType+'&page[offset]='+offset+'&page[limit]=50&sort=-progressed_at&include='+localListType+','+localListType+'.mappings,anime.mappings.item&fields['+localListType+']=slug,titles,averageRating,posterImage,'+(localListType == 'anime'? 'episodeCount': 'chapterCount,volumeCount'),
      headers: {
        'Authorization': 'Bearer ' + helper.accessToken(),
        'Content-Type': 'application/vnd.api+json',
        'Accept': 'application/vnd.api+json',
      },
      data: {},
    }).then((response) => {
      var res = JSON.parse(response.responseText);
      con.log(res);
      helper.errorHandling(res);
      var data = prepareData(res, localListType);
      con.error(data);

      if(typeof callbacks.singleCallback !== 'undefined'){
        // @ts-ignore
        if(!data.length) callbacks.singleCallback(false, 0, 0);
        for (var i = 0; i < data.length; i++) {
          // @ts-ignore
          callbacks.singleCallback(data[i], i+offset+1, data.length+offset);
        }
      }
      if(typeof callbacks.fullListCallback !== 'undefined'){
        // @ts-ignore
        templist = templist.concat(data);
      }
      if(res.meta.count > (offset + 50)){
        if(typeof callbacks.continueCall !== 'undefined'){
          // @ts-ignore
          callbacks.continueCall(function(){
            userList(status, localListType, callbacks, username, offset + 50, templist);
          });
        }else{
          userList(status, localListType, callbacks, username, offset + 50, templist);
        }
      }else{
        // @ts-ignore
        if(typeof callbacks.fullListCallback !== 'undefined') callbacks.fullListCallback(templist);
        // @ts-ignore
        if(typeof callbacks.finishCallback !== 'undefined') callbacks.finishCallback();
      }
    });
}

export interface listElement {
  id: number,
  type: "anime"|"manga"
  title: string,
  url: string,
  watchedEp: number,
  totalEp: number,
  image: string,
  tags: string,
  airingState: number,
}

export function prepareData(data, listType): listElement[]{
  var newData = [] as listElement[];
  for (var i = 0; i < data.data.length; i++) {
    var list = data.data[i];
    var el = data.included[i];

    var name = el.attributes.titles.en;
    if(typeof name == 'undefined') name = el.attributes.titles.en_jp;
    if(typeof name == 'undefined') name = el.attributes.titles.ja_jp;

    var malId = NaN;
    for (var k = 0; k < data.included.length; k++) {
      var mapping = data.included[k];
      if(mapping.type == 'mappings'){
        if(mapping.attributes.externalSite === 'myanimelist/'+listType){
          if(mapping.relationships.item.data.id == el.id){
            con.log(name, mapping);
            malId = mapping.attributes.externalId;
          }
        }
      }
    }

    if(listType === "anime"){
      var tempData = {
        id: malId,
        type: listType,
        title: name,
        url: 'https://myanimelist.net/'+listType+'/'+malId+'/'+name,
        watchedEp: list.attributes.progress,
        totalEp: el.attributes.episodeCount,
        image: el.attributes.posterImage.large,
        tags: list.attributes.notes,
        airingState: el['anime_airing_status'],
      }
    }else{
      var tempData = {
        id: malId,
        type: listType,
        title: name,
        url: 'https://myanimelist.net/'+listType+'/'+malId+'/'+name,
        watchedEp: list.attributes.progress,
        totalEp: el.attributes.chapterCount,
        image: el.attributes.posterImage.large,
        tags: list.attributes.notes,
        airingState: el['anime_airing_status'],
      }
    }

    if(tempData.totalEp == null){
      tempData.totalEp = 0;
    }

    newData.push(tempData);
  }
  return newData;
}

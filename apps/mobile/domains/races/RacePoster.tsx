// Original verified media only. Omit missing photos and retain intrinsic proportions.
import {memo,useState} from 'react';
import {Image,StyleSheet,View} from 'react-native';
import {palette,radius} from '../../app/design-system/theme';
import {useOfficialImage} from '../media/officialImages';
import type {RacePosterSpec} from './poster';
export type RacePosterProps={spec:RacePosterSpec;raceName:string;height?:number;raceId?:string};
export const RacePoster=memo(function RacePoster({height=96,raceId,raceName}:RacePosterProps){
 const photo=useOfficialImage(raceId);const [failedUrl,setFailedUrl]=useState('');const usable=!!(photo?.sha256&&photo?.sourceUrl&&photo.url!==failedUrl);
 if(!usable||!photo)return null;
 const ratio=photo.width&&photo.height?photo.width/photo.height:undefined;
 const compact=!!photo.kind?.includes('logo')||!!photo.kind?.includes('poster')||!!ratio&&ratio<.95;
 return <View accessibilityLabel={`${raceName} ${photo.kind?.includes('logo')?'로고':photo.kind?.includes('poster')?'포스터':'대표 사진'}`} accessibilityRole="image" style={[s.root,ratio&&!compact?{aspectRatio:ratio}:{height}]}>
  <Image resizeMode={compact?'contain':'cover'} source={{uri:photo.url}} onError={()=>setFailedUrl(photo.url)} style={StyleSheet.absoluteFill}/>
 </View>;
});
const s=StyleSheet.create({root:{width:'100%',backgroundColor:palette.surface,borderRadius:radius.sm,overflow:'hidden',justifyContent:'center',alignItems:'center'}});

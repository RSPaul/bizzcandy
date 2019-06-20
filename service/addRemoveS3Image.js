module.exports = function(s3Bucket, type, imageKey, productImage) {
    if(type === 'add') {
        var data = { Key: imageKey, ContentType: 'image', Body: productImage.data, ACL: 'public-read' };
        s3Bucket.putObject(data, function (err, result) {
            if (err) return console.log('Error uploading data: ', result);         
            else console.log('File uploaded to S3: ', result);  
        });

    }else {
        s3Bucket.deleteObject({ Key: imageKey },function (err,data){
              if(err) return console.log('Error deleting image');              
          })
    }
}




ROOT_DIR=$(pwd)

deploy() {
    echo "Deploying $1"
    cd $ROOT_DIR/$1
    npm i
    npm run build
}

rm -rf **/node_modules
deploy "arxiv"
deploy "dblp"
deploy "semantic-scholar"
deploy "zotero"
